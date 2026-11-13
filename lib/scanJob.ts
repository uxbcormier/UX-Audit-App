import type { ScanJobStatus } from "@prisma/client";
import { prisma } from "./prisma";
import type { ScanPageRecord } from "./scanner/types";

// Keeps Scan.status (the coarse PENDING/RUNNING/COMPLETE/FAILED value the
// existing report page already polls on) in sync with ScanJob's finer
// lifecycle, without changing Scan.status's meaning or values — this is the
// one place that mapping is defined, so nothing re-derives it differently.
export function scanStatusForJob(
  jobStatus: ScanJobStatus
): "PENDING" | "RUNNING" | "COMPLETE" | "FAILED" {
  switch (jobStatus) {
    case "QUEUED":
      return "PENDING";
    case "DISCOVERING":
    case "CRAWLING":
    case "ANALYZING":
      return "RUNNING";
    case "COMPLETED":
    case "PARTIALLY_COMPLETED":
      return "COMPLETE";
    case "FAILED":
      return "FAILED";
  }
}

export async function createScanJob(scanId: string) {
  return prisma.scanJob.create({ data: { scanId } });
}

// Called once at the start of each execution attempt — including retries,
// which is what makes `attempt` meaningful across them. Clears any error/
// finishedAt left over from a previous failed attempt.
export async function startJobAttempt(scanId: string) {
  const now = new Date();
  return prisma.scanJob.update({
    where: { scanId },
    data: {
      status: "DISCOVERING",
      step: "discovering",
      attempt: { increment: 1 },
      startedAt: now,
      heartbeatAt: now,
      lastError: null,
      finishedAt: null,
    },
  });
}

// Call on every meaningful progress tick — this is what staleness detection
// (isJobHeartbeatStale below) checks against, instead of wall-clock time
// since job creation.
export async function advanceJob(scanId: string, status: ScanJobStatus, step?: string) {
  return prisma.scanJob.update({
    where: { scanId },
    data: { status, step: step ?? status.toLowerCase(), heartbeatAt: new Date() },
  });
}

export async function completeJob(scanId: string, opts: { partial: boolean }) {
  const now = new Date();
  return prisma.scanJob.update({
    where: { scanId },
    data: {
      status: opts.partial ? "PARTIALLY_COMPLETED" : "COMPLETED",
      step: null,
      heartbeatAt: now,
      finishedAt: now,
    },
  });
}

export async function failJob(scanId: string, error: string) {
  const now = new Date();
  return prisma.scanJob.update({
    where: { scanId },
    data: {
      status: "FAILED",
      heartbeatAt: now,
      finishedAt: now,
      // Bounded — this lands in a DB column and (eventually) an error
      // banner, not a log file; an unbounded stack trace doesn't belong in
      // either.
      lastError: error.slice(0, 2000),
    },
  });
}

// Upserts one ScanPage row per URL the scan's crawl considered — scanned,
// failed, skipped (robots/checkout), or excluded by budget — keyed on
// (scanId, url), so a retry re-considering the same URL updates the
// existing row rather than inserting a duplicate (see ScanPage's
// @@unique([scanId, url]) in prisma/schema.prisma). This is the real
// per-URL inventory behind the report's coverage summary (see
// lib/scanner/types.ts's ScanPageRecord and CoverageSummary).
export async function recordPageInventory(scanId: string, pages: ScanPageRecord[]) {
  await Promise.all(
    pages.map((p) =>
      prisma.scanPage.upsert({
        where: { scanId_url: { scanId, url: p.url } },
        create: {
          scanId,
          url: p.url,
          pageType: p.pageType,
          status: p.status,
          skipReason: p.skipReason,
          discoveredVia: p.discoveredVia,
        },
        update: { pageType: p.pageType, status: p.status, skipReason: p.skipReason },
      })
    )
  );
}

export interface ScanCoverage {
  totalDiscovered: number;
  scanned: number;
  failed: number;
  skipped: number;
  excludedByBudget: number;
  pageTypes: string[];
}

export async function getScanCoverage(scanId: string): Promise<ScanCoverage> {
  const pages = await prisma.scanPage.findMany({ where: { scanId } });
  const pageTypes = new Set<string>();
  let scanned = 0;
  let failed = 0;
  let skipped = 0;
  let excludedByBudget = 0;

  for (const p of pages) {
    if (p.pageType) pageTypes.add(p.pageType);
    if (p.status === "SCANNED") scanned++;
    else if (p.status === "FAILED") failed++;
    else if (p.status === "SKIPPED") skipped++;
    else if (p.status === "EXCLUDED_BY_BUDGET") excludedByBudget++;
  }

  return {
    totalDiscovered: pages.length,
    scanned,
    failed,
    skipped,
    excludedByBudget,
    pageTypes: [...pageTypes],
  };
}

// A real multi-page crawl can legitimately run for minutes, so "created
// more than N seconds ago" (the old heuristic) was never a safe proxy for
// "stuck" — this checks how long it's been since the job last reported
// progress instead. Only active-phase jobs can go stale; a job already in
// a terminal status is never "stale," it's just done.
const STALE_HEARTBEAT_MS = 10 * 60 * 1000;
const ACTIVE_JOB_STATUSES: ScanJobStatus[] = ["QUEUED", "DISCOVERING", "CRAWLING", "ANALYZING"];

export function isJobHeartbeatStale(job: {
  status: ScanJobStatus;
  heartbeatAt: Date | null;
  createdAt: Date;
}): boolean {
  if (!ACTIVE_JOB_STATUSES.includes(job.status)) return false;
  const lastSignal = job.heartbeatAt ?? job.createdAt;
  return Date.now() - lastSignal.getTime() > STALE_HEARTBEAT_MS;
}
