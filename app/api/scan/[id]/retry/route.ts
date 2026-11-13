import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeScan } from "@/lib/scanExecution";

// Same budget as the initial scan route — a retry re-runs the identical
// execution path (see lib/scanExecution.ts), so it needs the same room.
export const maxDuration = 60;

// Re-runs a failed scan against the same Scan row — never creates a new
// Scan or Payment, so this can't duplicate a charge (payment and
// execution are fully decoupled; see executeScan's own comment) and can't
// duplicate findings (ScanPage rows are upserted by (scanId, url), and a
// fresh runFullScan() simply overwrites teaserResults/fullResults rather
// than appending to them).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scan = await prisma.scan.findUnique({ where: { id }, include: { job: true } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }
  if (!scan.job) {
    return NextResponse.json({ error: "This scan has no retryable job record." }, { status: 409 });
  }
  if (scan.job.status !== "FAILED") {
    return NextResponse.json(
      { error: `Only a failed scan can be retried (current status: ${scan.job.status}).` },
      { status: 409 }
    );
  }
  if (scan.job.attempt >= scan.job.maxAttempts) {
    return NextResponse.json(
      { error: `This scan has already used all ${scan.job.maxAttempts} retry attempts.` },
      { status: 409 }
    );
  }

  await prisma.scan.update({ where: { id }, data: { status: "RUNNING", failureReason: null } });

  after(() => executeScan(id, scan.url));

  return NextResponse.json({ scanId: id });
}
