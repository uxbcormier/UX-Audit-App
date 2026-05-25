import { runPageSpeed } from "./pagespeed";
import { scrapePage } from "./scraper";
import { runSeoChecks } from "./checks/seo";
import { runUxChecks } from "./checks/ux";
import { runTrustChecks } from "./checks/trust";
import { runPerformanceChecks } from "./checks/performance";
import type { AuditIssue, FullResults, IssueCategory, IssueSeverity, TeaserResults } from "./types";

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 25,
  high: 15,
  warning: 8,
  low: 3,
};

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

export async function runFullScan(url: string): Promise<{ teaser: TeaserResults; full: FullResults }> {
  const [psResult, page] = await Promise.all([
    runPageSpeed(url).catch(() => null),
    scrapePage(url),
  ]);

  const seoIssues = runSeoChecks(page);
  const uxIssues = runUxChecks(page);
  const trustIssues = runTrustChecks(page);
  const perfIssues = psResult ? runPerformanceChecks(psResult) : [];

  const allIssues: AuditIssue[] = [
    ...seoIssues,
    ...uxIssues,
    ...trustIssues,
    ...perfIssues,
  ].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);

  const overallScore = calcScore(allIssues);
  const revenueLoss = calcRevenueLoss(allIssues);
  const grade = scoreToGrade(overallScore);
  const summary = categorySummary(allIssues);

  const pageSpeed = {
    mobileScore: psResult?.mobileScore ?? 0,
    desktopScore: psResult?.desktopScore ?? 0,
  };

  const teaser: TeaserResults = {
    overallScore,
    revenueLoss,
    grade,
    issues: allIssues.slice(0, 3),
    totalIssueCount: allIssues.length,
    categorySummary: summary,
    pageSpeed,
  };

  const full: FullResults = {
    overallScore,
    revenueLoss,
    grade,
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
