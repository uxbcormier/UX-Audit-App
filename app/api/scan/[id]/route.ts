import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { payment: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
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
