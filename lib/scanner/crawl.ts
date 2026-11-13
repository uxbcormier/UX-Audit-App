import type { BrowserContext } from "playwright-core";
import { scrapeWithContext, type ScrapedPage } from "./scraper";
import { classifyPage, type SiteType } from "./pageClassification";
import { discoverPages } from "./discovery";
import { runSeoChecks } from "./checks/seo";
import { runTrustChecks } from "./checks/trust";
import { runAccessibilityChecks } from "./checks/accessibility";
import { runProductChecks } from "./checks/product";
import type { DraftIssue, ScanPageRecord } from "./types";

// Total pages per scan, homepage included — deliberately a representative
// sample, not an attempt at exhaustive coverage. Kept here as the single
// place that number is defined, so the report's "N pages inspected" claim
// and the actual crawl loop can never drift apart.
export const DEFAULT_CRAWL_BUDGET = 12;

// A hard ceiling on how long the additional-page crawl loop may run,
// checked before starting each new page. This exists because the whole
// scan route still runs inside a single Vercel function with a 60s
// maxDuration (see app/api/scan/route.ts) — there is no background job
// queue yet, so a real multi-page crawl has to fit inside one request.
// Anything this cuts off is recorded as EXCLUDED_BY_BUDGET with an honest
// reason, never silently dropped. Moving this to genuine background
// execution (so a slower site doesn't have to rush) is exactly the
// Stage 3 work already scoped and awaiting its own go-ahead — this budget
// is the safe, honest thing to ship before that exists, not a replacement
// for it.
const CRAWL_TIME_BUDGET_MS = 35_000;

// No screenshot (not shown for these pages), and the same light-touch
// options already proven for the single product-page hop in index.ts's
// scanProductPage — including the networkidle wait, which real storefronts
// (Shopify/Next.js PDPs especially) need before their purchase controls
// exist in the DOM at all.
const LIGHT_SCRAPE_OPTIONS = { waitForNetworkIdle: true, captureScreenshot: false, navTimeoutMs: 10000 };

export interface CrawledPageResult {
  url: string;
  pageType: string;
  issues: DraftIssue[];
  limitations: string[];
}

export interface CrawlOutcome {
  pageResults: CrawledPageResult[];
  pageRecords: ScanPageRecord[];
  totalDiscovered: number;
  sitemapFound: boolean;
  crawlBudget: number;
  // Every URL (if any) this crawl itself classified as a product page,
  // independent of whatever scanProductPage separately found — used to
  // broaden "was a product page scanned" beyond that single hop.
  productPageUrls: string[];
}

// Discovers and crawls up to DEFAULT_CRAWL_BUDGET-1 additional pages beyond
// the homepage (already scraped by the caller), via sitemap + homepage
// links (see discovery.ts), running the page-type-agnostic checks (SEO,
// Trust, Accessibility — all genuinely meaningful on any page) plus product
// checks on anything classified as a product page. UX checks and the
// mobile-viewport audit stay homepage-only — several UX check ids/titles
// are written in homepage-specific terms (e.g. "ad network detected on
// *homepage*"), and generalizing that wording is separate work from
// crawling more pages.
export async function crawlAdditionalPages(
  context: BrowserContext,
  homepage: ScrapedPage,
  baseUrl: string,
  siteType: SiteType,
  scanStartedAt: number,
  budget: number = DEFAULT_CRAWL_BUDGET
): Promise<CrawlOutcome> {
  const discovery = await discoverPages(homepage, baseUrl, Math.max(0, budget - 1));

  const pageResults: CrawledPageResult[] = [];
  const pageRecords: ScanPageRecord[] = [];
  const productPageUrls: string[] = [];

  for (const robotsUrl of discovery.disallowedByRobots) {
    pageRecords.push({
      url: robotsUrl,
      pageType: null,
      status: "SKIPPED",
      skipReason: "Disallowed by robots.txt for this scanner's user-agent.",
      discoveredVia: null,
    });
  }
  for (const checkoutUrl of discovery.excludedCheckoutUrls) {
    pageRecords.push({
      url: checkoutUrl,
      pageType: "checkout",
      status: "SKIPPED",
      skipReason: "Checkout pages are never crawled, even when publicly reachable.",
      discoveredVia: null,
    });
  }

  let timeBudgetExhausted = false;

  for (const candidate of discovery.candidates) {
    if (!timeBudgetExhausted && Date.now() - scanStartedAt > CRAWL_TIME_BUDGET_MS) {
      timeBudgetExhausted = true;
    }
    if (timeBudgetExhausted) {
      pageRecords.push({
        url: candidate.url,
        pageType: null,
        status: "EXCLUDED_BY_BUDGET",
        skipReason: "This scan's time budget was reached before this page could be crawled.",
        discoveredVia: candidate.discoveredVia,
      });
      continue;
    }

    try {
      const scraped = await scrapeWithContext(context, candidate.url, LIGHT_SCRAPE_OPTIONS);
      const classification = classifyPage(scraped, candidate.url);

      const issues: DraftIssue[] = [];
      const limitations: string[] = [];

      const seo = runSeoChecks(scraped);
      const trust = runTrustChecks(scraped, siteType);
      const accessibility = runAccessibilityChecks(scraped);
      issues.push(...seo.issues, ...trust.issues, ...accessibility.issues);
      limitations.push(...seo.limitations, ...trust.limitations, ...accessibility.limitations);

      if (classification.pageType === "product" && classification.confidence >= 50) {
        const product = runProductChecks(scraped, candidate.url, classification);
        issues.push(...product.issues);
        limitations.push(...product.limitations);
        productPageUrls.push(candidate.url);
      }

      pageResults.push({ url: candidate.url, pageType: classification.pageType, issues, limitations });
      pageRecords.push({
        url: candidate.url,
        pageType: classification.pageType,
        status: "SCANNED",
        skipReason: null,
        discoveredVia: candidate.discoveredVia,
      });
    } catch (err) {
      pageRecords.push({
        url: candidate.url,
        pageType: null,
        status: "FAILED",
        skipReason: err instanceof Error ? err.message : "This page could not be reached or rendered.",
        discoveredVia: candidate.discoveredVia,
      });
    }
  }

  // Discovered and eligible, but a per-type quota or the overall budget
  // was already full before this URL's turn — see discovery.ts.
  for (const budgetUrl of discovery.excludedByBudgetUrls) {
    pageRecords.push({
      url: budgetUrl,
      pageType: null,
      status: "EXCLUDED_BY_BUDGET",
      skipReason: "This scan's crawl budget was reached before this page was selected to crawl.",
      discoveredVia: null,
    });
  }

  return {
    pageResults,
    pageRecords,
    totalDiscovered: discovery.totalDiscovered,
    sitemapFound: discovery.sitemapFound,
    crawlBudget: budget,
    productPageUrls,
  };
}
