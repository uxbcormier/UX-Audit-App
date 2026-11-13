import { describe, it, expect } from "vitest";
import type { ScanJobStatus } from "@prisma/client";
import { scanStatusForJob, isJobHeartbeatStale } from "../scanJob";

// These cover the pure, DB-independent logic in lib/scanJob.ts —
// scanStatusForJob and isJobHeartbeatStale take plain values and have no
// Prisma calls, so they're testable without a live database. The
// Prisma-touching functions in the same file (createScanJob, advanceJob,
// completeJob, failJob, recordScannedPages, getScanCoverage) and
// lib/scanExecution.ts's executeScan() are NOT covered here — this
// environment has no DATABASE_URL to run them against. Those need manual
// verification against a real Postgres instance (or a future test-DB
// setup) before relying on them in production.

describe("scanStatusForJob", () => {
  it("maps QUEUED to PENDING", () => {
    expect(scanStatusForJob("QUEUED")).toBe("PENDING");
  });

  it("maps the three in-progress job statuses to RUNNING", () => {
    expect(scanStatusForJob("DISCOVERING")).toBe("RUNNING");
    expect(scanStatusForJob("CRAWLING")).toBe("RUNNING");
    expect(scanStatusForJob("ANALYZING")).toBe("RUNNING");
  });

  it("maps both COMPLETED and PARTIALLY_COMPLETED to COMPLETE", () => {
    expect(scanStatusForJob("COMPLETED")).toBe("COMPLETE");
    expect(scanStatusForJob("PARTIALLY_COMPLETED")).toBe("COMPLETE");
  });

  it("maps FAILED to FAILED", () => {
    expect(scanStatusForJob("FAILED")).toBe("FAILED");
  });
});

describe("isJobHeartbeatStale", () => {
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

  it("is not stale when the heartbeat is recent", () => {
    const job = { status: "CRAWLING" as ScanJobStatus, heartbeatAt: minutesAgo(1), createdAt: minutesAgo(1) };
    expect(isJobHeartbeatStale(job)).toBe(false);
  });

  it("is stale when the heartbeat hasn't moved in over 10 minutes on an active job", () => {
    const job = { status: "CRAWLING" as ScanJobStatus, heartbeatAt: minutesAgo(15), createdAt: minutesAgo(15) };
    expect(isJobHeartbeatStale(job)).toBe(true);
  });

  it("falls back to createdAt when heartbeatAt is null", () => {
    const stale = { status: "QUEUED" as ScanJobStatus, heartbeatAt: null, createdAt: minutesAgo(15) };
    const fresh = { status: "QUEUED" as ScanJobStatus, heartbeatAt: null, createdAt: minutesAgo(1) };
    expect(isJobHeartbeatStale(stale)).toBe(true);
    expect(isJobHeartbeatStale(fresh)).toBe(false);
  });

  it("never flags a job in a terminal status as stale, no matter how old its heartbeat is", () => {
    const veryOld = minutesAgo(60);
    for (const status of ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED"] as ScanJobStatus[]) {
      expect(isJobHeartbeatStale({ status, heartbeatAt: veryOld, createdAt: veryOld })).toBe(false);
    }
  });
});
