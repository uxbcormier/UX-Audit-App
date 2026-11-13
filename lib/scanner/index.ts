import type { BrowserContext } from "playwright-core";
import { runPageSpeed } from "./pagespeed";
import { captureMobileRenderAudit, launchScanSession, scrapeWithContext, type ScrapedPage } from "./scraper";
import { detectIndustry } from "./industry";
import { findProductLink, findShopLink } from "./productDiscovery";
import { runSeoChecks } from "./checks/seo";
import { runUxChecks } from "./checks/ux";
import { runTrustChecks } from "./checks/trust";
import { runPerformanceChecks } from "./checks/performance";
import { runProductChecks } from "./checks/product";
import { runMobileChecks } from "./checks/mobile";
import { runAccessibilityChecks } from "./checks/accessibility";
import { classifyPage, classifySiteType } from "./pageClassification";
import { computeMetricResults, SEVERITY_WEIGHT } from "./metrics";
import { crawlAdditionalPages, DEFAULT_CRAWL_BUDGET } from "./crawl";
import type {
  AuditIssue,
  DraftIssue,
  FullResults,
  IssueCategory,
  TeaserResults,
} from "./types";

// Checks only ever see a ScrapedPage, not the URL it came from, so they
// build DraftIssue (no pageUrl) and this stamps the real one on
// immediately after each check runs — see DraftIssue's doc comment.
// affectedPageCount/affectedPageUrls start at the single-page default;
// groupIssuesAcrossPages (below) is what merges same-id findings from
// multiple pages into an accurate count.
function withPageUrl(issues: DraftIssue[], pageUrl: string): AuditIssue[] {
  return issues.map((issue) => ({ ...issue, pageUrl, affectedPageCount: 1, affectedPageUrls: [pageUrl] }));
}

// Checks run independently per page, so the raw per-page issue arrays can
// contain the same check id more than once once a scan covers more than
// one or two pages (e.g. the same missing-alt-text check firing on three
// different product pages). This merges those into one finding with an
// accurate affected-page count, rather than either counting the same
// defect as multiple separate penalties, or — the bug this replaces —
// silently dropping every occurrence after the first via a plain
// id-keyed Set, which would have under-counted real, widespread problems
// the moment a scan visited more than one page per check.
export function groupIssuesAcrossPages(issues: AuditIssue[]): AuditIssue[] {
  const groups = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    const existing = groups.get(issue.id);
    if (existing) existing.push(issue);
    else groups.set(issue.id, [issue]);
  }

  return [...groups.values()].map((group) => {
    const [first] = group;
    const affectedPageUrls = [...new Set(group.map((i) => i.pageUrl))];
    return {
      ...first,
      affectedPageCount: affectedPageUrls.length,
      // Representative examples, not a full dump — same discipline as
      // Evidence.examples elsewhere.
      affectedPageUrls: affectedPageUrls.slice(0, 10),
    };
  });
}

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

// Exported so its reconciliation invariant (sum of counts === issues.length)
// can be tested directly rather than duplicated in a test file.
export function categorySummary(issues: AuditIssue[]): Record<IssueCategory, number> {
  const summary: Record<IssueCategory, number> = {
    SEO: 0,
    UX: 0,
    Trust: 0,
    Performance: 0,
    Conversion: 0,
    Accessibility: 0,
  };
  for (const issue of issues) summary[issue.category]++;
  return summary;
}

// Tries a direct product link from the homepage first, then falls back to one
// shop/collection-page hop to find one. No screenshot is captured (not shown
// for this page), which keeps a slow or unreachable secondary page from
// eating much of the route's time budget. The network-idle wait IS kept,
// though, capped at 5s by scrapeWithContext — many storefronts (Canada
// Goose among them) render their PDP's "Add to Bag" button client-side via
// React/Next.js after `domcontentloaded` fires, so skipping that wait was
// capturing an incomplete DOM and producing false "no Add to Cart button"
// findings on real, working product pages. Any failure here is swallowed —
// a missing or broken product page should never fail the whole scan.
// Exported for regression testing (see __tests__/scanProductPage.test.ts) —
// not part of the public scanning API otherwise.
export async function scanProductPage(
  context: BrowserContext,
  homepage: ScrapedPage,
  baseUrl: string
): Promise<{ issues: DraftIssue[]; limitations: string[]; productPageUrl: string | null }> {
  const lightOptions = { waitForNetworkIdle: true, captureScreenshot: false, navTimeoutMs: 10000 };

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
      return { issues: [], limitations: [], productPageUrl: null };
    }

    const productPage = await scrapeWithContext(context, productUrl, lightOptions);
    const classification = classifyPage(productPage, productUrl);

    if (classification.pageType !== "product") {
      return { issues: [], limitations: [], productPageUrl: null };
    }

    const { issues, limitations } = runProductChecks(productPage, productUrl, classification);
    return { issues, limitations, productPageUrl: productUrl };
  } catch {
    return { issues: [], limitations: [], productPageUrl: null };
  }
}

export async function runFullScan(url: string): Promise<{ teaser: TeaserResults; full: FullResults }> {
  const scanStartedAt = Date.now();
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
    const mobileAuditPromise = captureMobileRenderAudit(browser, url).catch(() => null);

    // A preliminary siteType, computed before the crawl/product-page
    // results are in, so the crawl's own per-page trust checks (which need
    // a siteType to gate ecommerce-only findings) can start immediately
    // rather than waiting on productPromise. Recomputed for real below once
    // every page's results are in — this preliminary value can only ever
    // be wrong in the narrow direction of calling a genuine ecommerce site
    // "general" one checking cycle too early, never the other way, since a
    // product page found later only ever makes classifySiteType MORE likely
    // to say "ecommerce," not less (see its own doc comment).
    const preliminarySiteType = classifySiteType(page, false);
    const crawlPromise = crawlAdditionalPages(
      context,
      page,
      url,
      preliminarySiteType,
      scanStartedAt,
      DEFAULT_CRAWL_BUDGET
    );

    const [
      psResult,
      { issues: productIssues, limitations: productLimitations, productPageUrl },
      mobileAudit,
      crawlResult,
    ] = await Promise.all([pageSpeedPromise, productPromise, mobileAuditPromise, crawlPromise]);

    const industry = detectIndustry(page);
    const anyProductPageFound = Boolean(productPageUrl) || crawlResult.productPageUrls.length > 0;
    // A real discovered product page is decisive; short of that,
    // classifySiteType looks for independent cart/shop + price-density
    // signals on the homepage itself — see its doc comment for why this
    // doesn't flip on a single stray signal.
    const siteType = classifySiteType(page, anyProductPageFound);

    const { issues: seoIssues, limitations: seoLimitations } = runSeoChecks(page);
    const { issues: uxIssues, limitations: uxLimitations } = runUxChecks(page, siteType);
    const { issues: trustIssues, limitations: trustLimitations } = runTrustChecks(page, siteType);
    const perfIssues = psResult ? runPerformanceChecks(psResult) : [];
    const { issues: mobileIssues, limitations: mobileLimitations } = runMobileChecks(mobileAudit);
    const { issues: accessibilityIssues, limitations: accessibilityLimitations } = runAccessibilityChecks(page);

    // Product-page checks are stamped with the actual product page URL
    // (falling back to the homepage URL only in the defensive case where
    // productPageUrl somehow came back null alongside non-empty issues,
    // which shouldn't happen but shouldn't produce an invalid pageUrl
    // either if it did).
    const combinedIssues: AuditIssue[] = [
      ...withPageUrl(seoIssues, url),
      ...withPageUrl(uxIssues, url),
      ...withPageUrl(trustIssues, url),
      ...withPageUrl(perfIssues, url),
      ...withPageUrl(mobileIssues, url),
      ...withPageUrl(accessibilityIssues, url),
      ...withPageUrl(productIssues, productPageUrl ?? url),
      ...crawlResult.pageResults.flatMap((pr) => withPageUrl(pr.issues, pr.url)),
    ];

    const allIssues: AuditIssue[] = groupIssuesAcrossPages(combinedIssues).sort(
      (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]
    );

    const overallScore = calcScore(allIssues);
    const grade = scoreToGrade(overallScore);
    const summary = categorySummary(allIssues);
    const metrics = computeMetricResults(allIssues, {
      productPageScanned: anyProductPageFound,
      pageSpeedAvailable: Boolean(psResult),
    });
    const highImpactCount = allIssues.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    ).length;

    const pageSpeed = {
      mobileScore: psResult?.mobileScore ?? 0,
      desktopScore: psResult?.desktopScore ?? 0,
    };

    const pagesInspected: { url: string; type: string }[] = [{ url, type: "homepage" }];
    if (productPageUrl) {
      pagesInspected.push({ url: productPageUrl, type: "product" });
    }
    for (const pr of crawlResult.pageResults) {
      pagesInspected.push({ url: pr.url, type: pr.pageType });
    }

    const pageInventory: FullResults["pageInventory"] = [
      { url, pageType: "homepage", status: "SCANNED", skipReason: null, discoveredVia: "homepage" },
      ...(productPageUrl
        ? ([
            {
              url: productPageUrl,
              pageType: "product",
              status: "SCANNED",
              skipReason: null,
              discoveredVia: "homepage-link",
            },
          ] as FullResults["pageInventory"])
        : []),
      ...crawlResult.pageRecords,
    ];

    const pageTypesScanned = [...new Set(pagesInspected.map((p) => p.type))];

    const coverage: TeaserResults["coverage"] = {
      totalDiscovered: crawlResult.totalDiscovered,
      pagesScanned: pagesInspected.length,
      pagesFailed: crawlResult.pageRecords.filter((r) => r.status === "FAILED").length,
      pagesSkipped: crawlResult.pageRecords.filter((r) => r.status === "SKIPPED").length,
      pagesExcludedByBudget: crawlResult.pageRecords.filter((r) => r.status === "EXCLUDED_BY_BUDGET").length,
      sitemapFound: crawlResult.sitemapFound,
      crawlBudget: crawlResult.crawlBudget,
      pageTypesScanned,
    };

    const limitations: string[] = [
      ...seoLimitations,
      ...uxLimitations,
      ...trustLimitations,
      ...mobileLimitations,
      ...accessibilityLimitations,
      ...productLimitations,
      ...crawlResult.pageResults.flatMap((pr) => pr.limitations),
    ];
    if (!productPageUrl && crawlResult.productPageUrls.length === 0) {
      limitations.push(
        "No product page could be discovered and confidently classified alongside the homepage — this report covers the pages actually listed below, not the full store."
      );
    }
    if (coverage.totalDiscovered > coverage.pagesScanned - 1) {
      limitations.push(
        `This scan discovered ${coverage.totalDiscovered} page${coverage.totalDiscovered === 1 ? "" : "s"} beyond the homepage, but only inspected ${coverage.pagesScanned} page${coverage.pagesScanned === 1 ? "" : "s"} total (this scan's representative-sample budget) — this is not a full-site audit.`
      );
    }

    const teaser: TeaserResults = {
      overallScore,
      grade,
      industry,
      siteType,
      benchmark: PLACEHOLDER_BENCHMARK,
      opportunitySummary: { highImpactCount },
      metrics,
      issues: allIssues.slice(0, 3),
      totalIssueCount: allIssues.length,
      categorySummary: summary,
      pageSpeed,
      screenshotUrl: page.screenshotDataUrl,
      productPageScanned: anyProductPageFound,
      productPageUrl: productPageUrl ?? crawlResult.productPageUrls[0] ?? null,
      pagesInspected,
      coverage,
      limitations,
    };

    const full: FullResults = {
      ...teaser,
      issues: allIssues,
      recommendations: generateRecommendations(allIssues, metrics),
      pageUrl: url,
      scannedAt: new Date().toISOString(),
      pageInventory,
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
