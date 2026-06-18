import { prisma } from "@/lib/prisma";

// Published-ish ecommerce baseline, used until we've accumulated enough of
// our own scans in a given industry to trust a real average.
const FALLBACK_AVG_SCORE = 72;
const FALLBACK_TOP_SCORE = 85;

// Below this many completed scans in an industry, our own average is too
// noisy to show as if it were a stable benchmark.
const MIN_SAMPLE_SIZE = 5;

export interface IndustryBenchmark {
  avgScore: number;
  topScore: number;
  sampleSize: number;
  isFallback: boolean;
}

// Computes a same-industry benchmark from our own completed scans rather
// than an invented or third-party number, falling back to a generic
// baseline (clearly labeled by `isFallback`) until there's enough real data.
export async function getIndustryBenchmark(industry: string): Promise<IndustryBenchmark> {
  const scans = await prisma.scan.findMany({
    where: { industry, status: "COMPLETE", overallScore: { not: null } },
    select: { overallScore: true },
  });

  if (scans.length < MIN_SAMPLE_SIZE) {
    return {
      avgScore: FALLBACK_AVG_SCORE,
      topScore: FALLBACK_TOP_SCORE,
      sampleSize: scans.length,
      isFallback: true,
    };
  }

  const scores = scans.map((s) => s.overallScore!).sort((a, b) => a - b);
  const avgScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  // "Top brands" = average of the top quartile of real scores we've seen,
  // not just the single highest (which could be one lucky/simple site).
  const topQuartileStart = Math.floor(scores.length * 0.75);
  const topQuartile = scores.slice(topQuartileStart);
  const topScore = Math.round(topQuartile.reduce((sum, s) => sum + s, 0) / topQuartile.length);

  return {
    avgScore,
    topScore: Math.max(topScore, avgScore + 1),
    sampleSize: scores.length,
    isFallback: false,
  };
}
