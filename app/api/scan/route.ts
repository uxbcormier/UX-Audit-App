import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runFullScan } from "@/lib/scanner";

const schema = z.object({
  url: z.string().url("Please enter a valid URL including http:// or https://"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { url } = parsed.data;

  const scan = await prisma.scan.create({
    data: { url, status: "RUNNING" },
  });

  // Run scan async — respond immediately with scan ID
  runFullScan(url)
    .then(async ({ teaser, full }) => {
      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETE",
          teaserResults: teaser as object,
          fullResults: full as object,
          overallScore: teaser.overallScore,
          revenueLoss: teaser.revenueLoss,
        },
      });
    })
    .catch(async (err) => {
      console.error("Scan failed:", err);
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "FAILED" },
      });
    });

  return NextResponse.json({ scanId: scan.id });
}
