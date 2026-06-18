import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runFullScan } from "@/lib/scanner";
import { ScrapeError } from "@/lib/scanner/scraper";
import { getIndustryBenchmark } from "@/lib/scanner/benchmark";

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

  // Scheduled to run after the response is sent, but the platform keeps the
  // function alive until it finishes (see Next.js `after`) — more reliable
  // for a long-running scan than a bare floating promise.
  after(async () => {
    try {
      const { teaser, full } = await runFullScan(url);
      const benchmark = await getIndustryBenchmark(teaser.industry);

      teaser.industryAvgScore = benchmark.avgScore;
      teaser.topBrandScore = benchmark.topScore;
      teaser.benchmarkSampleSize = benchmark.sampleSize;
      teaser.benchmarkIsFallback = benchmark.isFallback;
      full.industryAvgScore = benchmark.avgScore;
      full.topBrandScore = benchmark.topScore;
      full.benchmarkSampleSize = benchmark.sampleSize;
      full.benchmarkIsFallback = benchmark.isFallback;

      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETE",
          teaserResults: teaser as object,
          fullResults: full as object,
          overallScore: teaser.overallScore,
          revenueLoss: teaser.revenueLoss,
          industry: teaser.industry,
        },
      });
    } catch (err) {
      console.error("Scan failed:", err);
      const failureReason = err instanceof ScrapeError ? err.reason : "unreachable";
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "FAILED", failureReason },
      });
    }
  });

  return NextResponse.json({ scanId: scan.id });
}
