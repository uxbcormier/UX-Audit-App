import { prisma } from "@/lib/prisma";
import type { BenchmarkTier, IndustryBenchmarkInfo } from "./types";

// Generic published-ish baseline, shown only until we have enough real
// scans of our own — never presented as a measured industry benchmark.
const FALLBACK_AVG_SCORE = 72;
const FALLBACK_TOP_SCORE = 85;

// As the sample size grows, the bar for calling it a real benchmark (vs.
// an "early estimate") rises too — a handful of scans shouldn't carry the
// same implied confidence as a few hundred. See tierFor().
const EARLY_THRESHOLD = 5;
const GROWING_THRESHOLD = 20;
const ESTABLISHED_THRESHOLD = 50;

const TIER_LABEL: Record<BenchmarkTier, string> = {
  fallback: "Early benchmark estimate",
  early: "Early benchmark estimate",
  growing: "Growing benchmark",
  established: "Industry benchmark",
};

function tierFor(sampleSize: number): BenchmarkTier {
  if (sampleSize < EARLY_THRESHOLD) return "fallback";
  if (sampleSize < GROWING_THRESHOLD) return "early";
  if (sampleSize < ESTABLISHED_THRESHOLD) return "growing";
  return "established";
}

function percentileOf(score: number, sortedScores: number[]): number {
  if (sortedScores.length === 0) return 0;
  const countAtOrBelow = sortedScores.filter((s) => s <= score).length;
  return Math.round((countAtOrBelow / sortedScores.length) * 100);
}

function medianOf(sortedScores: number[]): number {
  const mid = Math.floor(sortedScores.length / 2);
  return sortedScores.length % 2 === 0
    ? Math.round((sortedScores[mid - 1] + sortedScores[mid]) / 2)
    : sortedScores[mid];
}

// Computes a same-industry benchmark from our own completed scans rather
// than an invented or third-party number, falling back to a generic
// baseline until there's enough real data — and never implying statistical
// confidence a small sample doesn't support (see TIER_LABEL/tierFor).
export async function getIndustryBenchmark(
  industry: string,
  userScore: number
): Promise<IndustryBenchmarkInfo> {
  const scans = await prisma.scan.findMany({
    where: { industry, status: "COMPLETE", overallScore: { not: null } },
    select: { overallScore: true },
  });

  const sampleSize = scans.length;
  const tier = tierFor(sampleSize);

  if (tier === "fallback") {
    return {
      avgScore: FALLBACK_AVG_SCORE,
      topQuartileScore: FALLBACK_TOP_SCORE,
      medianScore: null,
      sampleSize,
      tier,
      label: TIER_LABEL[tier],
      userPercentile: null,
    };
  }

  const scores = scans.map((s) => s.overallScore!).sort((a, b) => a - b);
  const avgScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  // "Top quartile" = average of the top 25% of real scores seen, not just
  // the single highest (which could be one lucky/simple site).
  const topQuartileStart = Math.floor(scores.length * 0.75);
  const topQuartile = scores.slice(topQuartileStart);
  const topQuartileScore = Math.round(
    topQuartile.reduce((sum, s) => sum + s, 0) / topQuartile.length
  );

  return {
    avgScore,
    topQuartileScore: Math.max(topQuartileScore, avgScore + 1),
    medianScore: medianOf(scores),
    sampleSize,
    tier,
    label: TIER_LABEL[tier],
    userPercentile: percentileOf(userScore, scores),
  };
}
