import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// If a scan is still PENDING/RUNNING this long after being created, the
// serverless function running it almost certainly got killed by the
// platform (timeout, crash, OOM launching Chromium) before its own catch
// block could mark it FAILED. Without this, the row stays RUNNING forever
// and the client polls indefinitely with no way out.
const STALE_SCAN_MS = 90_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let scan = await prisma.scan.findUnique({
    where: { id },
    include: { payment: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const isStale =
    (scan.status === "PENDING" || scan.status === "RUNNING") &&
    Date.now() - scan.createdAt.getTime() > STALE_SCAN_MS;

  if (isStale) {
    scan = await prisma.scan.update({
      where: { id },
      data: { status: "FAILED", failureReason: "timeout" },
      include: { payment: true },
    });
  }

  const isPaid = scan.payment?.status === "PAID";

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
  });
}
