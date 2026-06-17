import { runPageSpeed } from "./pagespeed";
import { scrapePage } from "./scraper";
import { runSeoChecks } from "./checks/seo";
import { runUxChecks } from "./checks/ux";
import { runTrustChecks } from "./checks/trust";
import { runPerformanceChecks } from "./checks/performance";
import { runBaymardChecks } from "./checks/baymard";
import type {
  AuditIssue,
  ConversionSignal,
  FullResults,
  IssueCategory,
  IssueSeverity,
  RevenueOpportunity,
  SignalSummary,
  TeaserResults,
} from "./types";

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 25,
  high: 15,
  warning: 8,
  low: 3,
};

// Published industry reference points shown alongside every score.
const INDUSTRY_AVG_SCORE = 72;
const TOP_BRAND_SCORE = 85;

function calcScore(issues: AuditIssue[]): number {
  const totalDeduction = issues.reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

function calcRevenueLoss(issues: AuditIssue[]): number {
  return issues.reduce((acc, i) => acc + i.revenueLossEstimate, 0);
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function categorySummary(issues: AuditIssue[]): Record<IssueCategory, number> {
  const summary: Record<IssueCategory, number> = {
    SEO: 0,
    UX: 0,
    Trust: 0,
    Performance: 0,
    Conversion: 0,
  };
  for (const issue of issues) summary[issue.category]++;
  return summary;
}

// Rounds to a "nice" figure so ranges read like an estimate, not a fake-precise number.
function roundNice(n: number): number {
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 10000) return Math.round(n / 100) * 100;
  return Math.round(n / 1000) * 1000;
}

function calcRevenueOpportunity(issues: AuditIssue[], score: number, annualLoss: number): RevenueOpportunity {
  const deficit = 100 - score;

  const conversionLiftLow = Math.max(2, Math.round(deficit * 0.25));
  const conversionLiftHigh = Math.max(conversionLiftLow + 3, Math.round(deficit * 0.47));

  const monthlyMidpoint = annualLoss / 12;
  const monthlyLossLow = roundNice(monthlyMidpoint * 0.65);
  const monthlyLossHigh = roundNice(monthlyMidpoint * 1.55);

  const FACTOR_LABEL: Record<IssueCategory, string> = {
    UX: "Product discovery & navigation friction",
    Trust: "Trust signal gaps",
    Performance: "Mobile & speed inefficiencies",
    SEO: "Search visibility gaps",
    Conversion: "Purchase flow friction",
  };

  const lossByCategory = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + i.revenueLossEstimate;
    return acc;
  }, {});

  const contributingFactors = Object.entries(lossByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => FACTOR_LABEL[category as IssueCategory]);

  return {
    conversionLiftLow,
    conversionLiftHigh,
    monthlyLossLow,
    monthlyLossHigh,
    annualLossLow: monthlyLossLow * 12,
    annualLossHigh: monthlyLossHigh * 12,
    contributingFactors,
  };
}

function calcSignalSummary(issues: AuditIssue[]): SignalSummary[] {
  const counts = new Map<ConversionSignal, number>();
  for (const issue of issues) {
    counts.set(issue.signal, (counts.get(issue.signal) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([signal, issueCount]) => ({ signal, issueCount }))
    .sort((a, b) => b.issueCount - a.issueCount);
}

export async function runFullScan(url: string): Promise<{ teaser: TeaserResults; full: FullResults }> {
  const [psResult, page] = await Promise.all([
    runPageSpeed(url).catch(() => null),
    scrapePage(url),
  ]);

  const seoIssues = runSeoChecks(page);
  const uxIssues = runUxChecks(page);
  const trustIssues = runTrustChecks(page);
  const baymardIssues = runBaymardChecks(page);
  const perfIssues = psResult ? runPerformanceChecks(psResult) : [];

  const allIssues: AuditIssue[] = [
    ...seoIssues,
    ...uxIssues,
    ...trustIssues,
    ...baymardIssues,
    ...perfIssues,
  ].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);

  const overallScore = calcScore(allIssues);
  const revenueLoss = calcRevenueLoss(allIssues);
  const grade = scoreToGrade(overallScore);
  const summary = categorySummary(allIssues);
  const revenueOpportunity = calcRevenueOpportunity(allIssues, overallScore, revenueLoss);
  const signalSummary = calcSignalSummary(allIssues);

  const pageSpeed = {
    mobileScore: psResult?.mobileScore ?? 0,
    desktopScore: psResult?.desktopScore ?? 0,
  };

  const teaser: TeaserResults = {
    overallScore,
    revenueLoss,
    grade,
    industryAvgScore: INDUSTRY_AVG_SCORE,
    topBrandScore: TOP_BRAND_SCORE,
    revenueOpportunity,
    signalSummary,
    issues: allIssues.slice(0, 3),
    totalIssueCount: allIssues.length,
    categorySummary: summary,
    pageSpeed,
  };

  const full: FullResults = {
    overallScore,
    revenueLoss,
    grade,
    industryAvgScore: INDUSTRY_AVG_SCORE,
    topBrandScore: TOP_BRAND_SCORE,
    revenueOpportunity,
    signalSummary,
    issues: allIssues,
    totalIssueCount: allIssues.length,
    categorySummary: summary,
    pageSpeed,
    recommendations: generateRecommendations(allIssues),
    pageUrl: url,
    scannedAt: new Date().toISOString(),
  };

  return { teaser, full };
}

function generateRecommendations(issues: AuditIssue[]): string[] {
  const criticals = issues.filter((i) => i.severity === "critical");
  const highs = issues.filter((i) => i.severity === "high");

  const recs: string[] = [];

  if (criticals.length > 0) {
    recs.push(`Fix ${criticals.length} critical issue${criticals.length > 1 ? "s" : ""} first — these are costing you the most revenue.`);
  }
  if (highs.length > 0) {
    recs.push(`Address ${highs.length} high-priority issue${highs.length > 1 ? "s" : ""} to significantly improve conversion rates.`);
  }

  const topByCategory = Object.entries(
    issues.reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + i.revenueLossEstimate;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  if (topByCategory[0]) {
    recs.push(`Your biggest revenue leak is in ${topByCategory[0][0]} — estimated $${topByCategory[0][1].toLocaleString()}/year.`);
  }

  return recs;
}
