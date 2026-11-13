import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { failJob, getScanCoverage, isJobHeartbeatStale } from "@/lib/scanJob";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let scan = await prisma.scan.findUnique({
    where: { id },
    include: { payment: true, job: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // A real multi-page crawl can legitimately run for minutes, so staleness
  // is judged by how long it's been since the job last reported progress
  // (see lib/scanJob.ts), not a fixed window since the scan was created —
  // the old 90s-since-creation heuristic would misfire on any scan that
  // takes longer than that to legitimately finish. Without this check at
  // all, a scan whose serverless function got killed outright (timeout,
  // crash, OOM launching Chromium) before its own catch block could run
  // would leave the row stuck RUNNING forever with no way out for the
  // client, which keeps polling.
  if (scan.job && isJobHeartbeatStale(scan.job)) {
    await failJob(scan.id, "No progress reported for 10 minutes — the job likely stopped running.");
    scan = await prisma.scan.update({
      where: { id },
      data: { status: "FAILED", failureReason: "timeout" },
      include: { payment: true, job: true },
    });
  }

  const isPaid = scan.payment?.status === "PAID";
  const coverage = await getScanCoverage(scan.id);

  return NextResponse.json({
    id: scan.id,
    url: scan.url,
    status: scan.status,
    overallScore: scan.overallScore,
    revenueLoss: scan.revenueLoss,
    teaserResults: scan.teaserResults,
    fullResults: isPaid ? scan.fullResults : null,
    isPaid,
    failureReason: scan.failureReason,
    createdAt: scan.createdAt,
    // Additive — not read by the current UI yet. jobStatus is the granular
    // state (queued/discovering/crawling/analyzing/completed/
    // partially_completed/failed); coverage is a real count of what was
    // actually scanned, not an estimate.
    jobStatus: scan.job?.status ?? null,
    jobStep: scan.job?.step ?? null,
    jobAttempt: scan.job?.attempt ?? null,
    coverage,
  });
}
