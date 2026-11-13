import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";

vi.mock("../scraper", async () => {
  const actual = await vi.importActual<typeof import("../scraper")>("../scraper");
  return { ...actual, scrapeWithContext: vi.fn() };
});
vi.mock("../discovery", () => ({ discoverPages: vi.fn() }));

import { crawlAdditionalPages } from "../crawl";
import { scrapeWithContext } from "../scraper";
import { discoverPages } from "../discovery";

function makeScrapedPage(overrides: Partial<ScrapedPage> = {}): ScrapedPage {
  const html = overrides.html ?? `<html><body><h1>Page</h1></body></html>`;
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: "Page",
    metaDescription: "",
    h1s: ["Page"],
    h2s: [],
    images: [],
    links: [],
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: [],
    headingAudit: { h1Count: 1, visibleH1Count: 1 },
    contrastAudit: null,
    evidenceComplete: true,
    ...overrides,
  };
}

const BASE_URL = "https://example.com";
const HOMEPAGE = makeScrapedPage();

function mockDiscovery(candidates: { url: string; priorityHint: string; discoveredVia: "sitemap" | "homepage-link" }[]) {
  vi.mocked(discoverPages).mockResolvedValue({
    candidates: candidates as never,
    totalDiscovered: candidates.length,
    sitemapFound: true,
    disallowedByRobots: [],
    excludedCheckoutUrls: [],
    excludedByBudgetUrls: [],
  });
}

describe("crawlAdditionalPages", () => {
  beforeEach(() => {
    vi.mocked(scrapeWithContext).mockReset();
  });

  it("scans each candidate and records it as SCANNED", async () => {
    mockDiscovery([{ url: "https://example.com/about", priorityHint: "about", discoveredVia: "homepage-link" }]);
    vi.mocked(scrapeWithContext).mockResolvedValue(makeScrapedPage());

    const result = await crawlAdditionalPages({} as never, HOMEPAGE, BASE_URL, "ecommerce", Date.now());

    expect(result.pageRecords).toHaveLength(1);
    expect(result.pageRecords[0].status).toBe("SCANNED");
    expect(result.pageResults).toHaveLength(1);
  });

  it("records a page that fails to load as FAILED, without throwing", async () => {
    mockDiscovery([{ url: "https://example.com/broken", priorityHint: "unknown", discoveredVia: "sitemap" }]);
    vi.mocked(scrapeWithContext).mockRejectedValue(new Error("Could not reach the page."));

    const result = await crawlAdditionalPages({} as never, HOMEPAGE, BASE_URL, "ecommerce", Date.now());

    expect(result.pageRecords).toHaveLength(1);
    expect(result.pageRecords[0].status).toBe("FAILED");
    expect(result.pageResults).toHaveLength(0);
  });

  it("excludes remaining candidates once the time budget is exhausted, without crawling them", async () => {
    mockDiscovery([
      { url: "https://example.com/a", priorityHint: "about", discoveredVia: "homepage-link" },
      { url: "https://example.com/b", priorityHint: "contact", discoveredVia: "homepage-link" },
    ]);
    vi.mocked(scrapeWithContext).mockResolvedValue(makeScrapedPage());

    // scanStartedAt far enough in the past that the crawl's own time budget
    // has already elapsed before the loop even starts.
    const longAgo = Date.now() - 10 * 60 * 1000;
    const result = await crawlAdditionalPages({} as never, HOMEPAGE, BASE_URL, "ecommerce", longAgo);

    expect(scrapeWithContext).not.toHaveBeenCalled();
    expect(result.pageRecords.every((r) => r.status === "EXCLUDED_BY_BUDGET")).toBe(true);
    expect(result.pageRecords).toHaveLength(2);
  });

  it("classifies and checks a product page with product-specific checks", async () => {
    mockDiscovery([{ url: "https://example.com/products/widget", priorityHint: "product", discoveredVia: "sitemap" }]);
    vi.mocked(scrapeWithContext).mockResolvedValue(
      makeScrapedPage({
        html: `<html><body><h1>Widget</h1><div>$49.99</div></body></html>`,
        interactiveElements: [
          {
            tag: "button",
            text: "Add to Cart",
            ariaLabel: null,
            role: null,
            type: null,
            href: null,
            disabled: false,
            visible: true,
            classes: "",
            testId: null,
          },
        ],
      })
    );

    const result = await crawlAdditionalPages({} as never, HOMEPAGE, BASE_URL, "ecommerce", Date.now());

    expect(result.productPageUrls).toContain("https://example.com/products/widget");
    expect(result.pageResults[0].pageType).toBe("product");
  });

  it("records robots-disallowed and checkout-excluded URLs as SKIPPED with a reason", async () => {
    vi.mocked(discoverPages).mockResolvedValue({
      candidates: [],
      totalDiscovered: 2,
      sitemapFound: false,
      disallowedByRobots: ["https://example.com/admin"],
      excludedCheckoutUrls: ["https://example.com/checkout"],
      excludedByBudgetUrls: [],
    });

    const result = await crawlAdditionalPages({} as never, HOMEPAGE, BASE_URL, "ecommerce", Date.now());

    const byUrl = Object.fromEntries(result.pageRecords.map((r) => [r.url, r]));
    expect(byUrl["https://example.com/admin"].status).toBe("SKIPPED");
    expect(byUrl["https://example.com/admin"].skipReason).toMatch(/robots/i);
    expect(byUrl["https://example.com/checkout"].status).toBe("SKIPPED");
    expect(byUrl["https://example.com/checkout"].skipReason).toMatch(/checkout/i);
  });
});
