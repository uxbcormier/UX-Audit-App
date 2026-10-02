import type { BrowserContext } from "playwright-core";
import { runPageSpeed } from "./pagespeed";
import { launchScanSession, scrapeWithContext, type ScrapedPage } from "./scraper";
import { detectIndustry } from "./industry";
import { findProductLink, findShopLink } from "./productDiscovery";
import { runSeoChecks } from "./checks/seo";
import { runUxChecks } from "./checks/ux";
import { runTrustChecks } from "./checks/trust";
import { runPerformanceChecks } from "./checks/performance";
import { looksLikeSingleProductPage, runProductChecks } from "./checks/product";
import { computeMetricResults, SEVERITY_WEIGHT } from "./metrics";
import type {
  AuditIssue,
  FullResults,
  IssueCategory,
  TeaserResults,
} from "./types";

// Placeholder benchmark shown until the caller (app/api/scan/route.ts)
// merges in a real one computed from our own scan history — kept here so
// the result shape is always valid even before that DB lookup runs.
const PLACEHOLDER_BENCHMARK: TeaserResults["benchmark"] = {
  avgScore: 72,
  topQuartileScore: 85,
  medianScore: null,
  sampleSize: 0,
  tier: "fallback",
  label: "Early benchmark estimate",
  userPercentile: null,
};

function calcScore(issues: AuditIssue[]): number {
  const totalDeduction = issues.reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);
  return Math.max(0, Math.min(100, 100 - totalDeduction));
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

// Tries a direct product link from the homepage first, then falls back to one
// shop/collection-page hop to find one. Light scrape options (no network-idle
// wait, no screenshot) keep a slow or unreachable secondary page from eating
// the route's time budget. Any failure here is swallowed — a missing or
// broken product page should never fail the whole scan.
async function scanProductPage(
  context: BrowserContext,
  homepage: ScrapedPage,
  baseUrl: string
): Promise<{ issues: AuditIssue[]; productPageUrl: string | null }> {
  const lightOptions = { waitForNetworkIdle: false, captureScreenshot: false, navTimeoutMs: 8000 };

  try {
    let productUrl = findProductLink(homepage, baseUrl);

    if (!productUrl) {
      const shopUrl = findShopLink(homepage, baseUrl);
      if (shopUrl) {
        const shopPage = await scrapeWithContext(context, shopUrl, lightOptions);
        productUrl = findProductLink(shopPage, shopUrl);
      }
    }

    if (!productUrl) {
      return { issues: [], productPageUrl: null };
    }

    const productPage = await scrapeWithContext(context, productUrl, lightOptions);

    if (!looksLikeSingleProductPage(productPage)) {
      return { issues: [], productPageUrl: null };
    }

    return { issues: runProductChecks(productPage, productUrl), productPageUrl: productUrl };
  } catch {
    return { issues: [], productPageUrl: null };
  }
}

export async function runFullScan(url: string): Promise<{ teaser: TeaserResults; full: FullResults }> {
  const { browser, context } = await launchScanSession();

  try {
    // PageSpeed's own round trip (a real Lighthouse run per strategy) is the
    // single slowest thing this route does. Kick it off immediately and let
    // it run in the background rather than blocking product-page discovery
    // on it — that discovery only depends on the homepage scrape, not on
    // PageSpeed, so serializing them wasted time against the route's
    // maxDuration budget for no reason.
    const pageSpeedPromise = runPageSpeed(url).catch(() => null);
    const page = await scrapeWithContext(context, url);
    const productPromise = scanProductPage(context, page, url);

    const [psResult, { issues: productIssues, productPageUrl }] = await Promise.all([
      pageSpeedPromise,
      productPromise,
    ]);

    const industry = detectIndustry(page);

    const seoIssues = runSeoChecks(page);
    const uxIssues = runUxChecks(page);
    const trustIssues = runTrustChecks(page);
    const perfIssues = psResult ? runPerformanceChecks(psResult) : [];

    const allIssues: AuditIssue[] = [
      ...seoIssues,
      ...uxIssues,
      ...trustIssues,
      ...perfIssues,
      ...productIssues,
    ].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);

    const overallScore = calcScore(allIssues);
    const grade = scoreToGrade(overallScore);
    const summary = categorySummary(allIssues);
    const metrics = computeMetricResults(allIssues, {
      productPageScanned: Boolean(productPageUrl),
      pageSpeedAvailable: Boolean(psResult),
    });
    const highImpactCount = allIssues.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    ).length;

    const pageSpeed = {
      mobileScore: psResult?.mobileScore ?? 0,
      desktopScore: psResult?.desktopScore ?? 0,
    };

    const teaser: TeaserResults = {
      overallScore,
      grade,
      industry,
      benchmark: PLACEHOLDER_BENCHMARK,
      revenueOpportunity: { hasEstimate: false, highImpactCount },
      metrics,
      issues: allIssues.slice(0, 3),
      totalIssueCount: allIssues.length,
      categorySummary: summary,
      pageSpeed,
      screenshotUrl: page.screenshotDataUrl,
      productPageScanned: Boolean(productPageUrl),
      productPageUrl,
    };

    const full: FullResults = {
      ...teaser,
      issues: allIssues,
      recommendations: generateRecommendations(allIssues, metrics),
      pageUrl: url,
      scannedAt: new Date().toISOString(),
    };

    return { teaser, full };
  } finally {
    await browser.close();
  }
}

function generateRecommendations(
  issues: AuditIssue[],
  metrics: TeaserResults["metrics"]
): string[] {
  const criticals = issues.filter((i) => i.severity === "critical");
  const highs = issues.filter((i) => i.severity === "high");

  const recs: string[] = [];

  if (criticals.length > 0) {
    recs.push(
      `Fix ${criticals.length} critical issue${criticals.length > 1 ? "s" : ""} first — these carry the highest business impact.`
    );
  }
  if (highs.length > 0) {
    recs.push(
      `Address ${highs.length} high-priority issue${highs.length > 1 ? "s" : ""} to strengthen the weakest parts of your experience.`
    );
  }

  const weakestEvaluated = metrics
    .filter((m) => m.evaluated && m.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  if (weakestEvaluated) {
    recs.push(`Your lowest-scoring area is ${weakestEvaluated.metric} (${weakestEvaluated.score}/100) — start there.`);
  }

  return recs;
}
