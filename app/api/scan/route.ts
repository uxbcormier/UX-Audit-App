import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createScanJob } from "@/lib/scanJob";
import { executeScan } from "@/lib/scanExecution";

// Headless-browser scans take longer than the old plain HTTP fetch did, so
// give the route more room than the platform default before it's killed.
// Kept at 60s so it stays deployable on Vercel's Hobby tier (its cap); raise
// this if you're on a paid plan and scans start timing out under load.
export const maxDuration = 60;

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
  // Scan creation and job execution are now separate steps (one DB write
  // each) — this is what makes a later retry possible: it re-enters at
  // executeScan() against the same scan/job row instead of needing to
  // recreate anything.
  await createScanJob(scan.id);

  // Scheduled to run after the response is sent, but the platform keeps the
  // function alive until it finishes (see Next.js `after`) — more reliable
  // for a long-running scan than a bare floating promise.
  after(() => executeScan(scan.id, url));

  return NextResponse.json({ scanId: scan.id });
}
