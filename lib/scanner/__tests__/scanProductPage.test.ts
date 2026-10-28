import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";

// scanProductPage() orchestrates real browser scraping + product-link
// discovery; these two failure-mode scenarios (page fails to load, and
// in-browser evidence collection comes back incomplete) are pipeline-level
// behavior that can't be exercised through pure fixtures like
// purchaseAction.test.ts — so the scraper and link-discovery modules are
// mocked here instead of hitting a real browser or network.
vi.mock("../scraper", async () => {
  const actual = await vi.importActual<typeof import("../scraper")>("../scraper");
  return {
    ...actual,
    launchScanSession: vi.fn(),
    scrapeWithContext: vi.fn(),
  };
});
vi.mock("../productDiscovery", () => ({
  findProductLink: vi.fn(),
  findShopLink: vi.fn(),
}));

import { scanProductPage } from "../index";
import { scrapeWithContext, ScrapeError } from "../scraper";
import { findProductLink } from "../productDiscovery";

function makeHomepage(): ScrapedPage {
  const html = `<html><body><h1>Shop</h1><a href="/products/widget">Widget</a></body></html>`;
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: "Shop",
    metaDescription: "",
    h1s: ["Shop"],
    h2s: [],
    images: [],
    links: [{ href: "/products/widget", text: "Widget" }],
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: [],
    evidenceComplete: true,
  };
}

const PRODUCT_URL = "https://example.com/products/widget";

describe("scanProductPage — pipeline-level failure handling", () => {
  beforeEach(() => {
    vi.mocked(findProductLink).mockReturnValue(PRODUCT_URL);
  });

  // Scenario 7: the product page fails to load or times out. Must not
  // crash the whole scan, and must never emit a defect finding — a failed
  // inspection is not evidence of a UX problem.
  it("swallows a scrape failure (page fails to load / times out) without emitting any issue", async () => {
    vi.mocked(scrapeWithContext).mockRejectedValueOnce(
      new ScrapeError("Could not reach the product page.", "unreachable")
    );

    const result = await scanProductPage({} as never, makeHomepage(), "https://example.com");

    expect(result.issues).toHaveLength(0);
    expect(result.productPageUrl).toBeNull();
  });

  // Scenario 12: evidence collection is incomplete (the in-browser
  // interactive-element inventory failed) but the page otherwise loaded.
  // Must disclose a limitation, never a confirmed "missing" defect.
  it("discloses a limitation instead of a defect when interactiveElements evidence is incomplete", async () => {
    const html = `
      <html><body>
        <h1>Widget</h1>
        <div class="price">$49.99</div>
      </body></html>
    `;
    const $ = cheerio.load(html);
    vi.mocked(scrapeWithContext).mockResolvedValueOnce({
      html,
      $,
      title: "Widget",
      metaDescription: "",
      h1s: ["Widget"],
      h2s: [],
      images: [],
      links: [],
      hasSSL: true,
      statusCode: 200,
      responseTimeMs: 100,
      screenshotDataUrl: null,
      interactiveElements: null,
      evidenceComplete: false,
    });

    const result = await scanProductPage({} as never, makeHomepage(), "https://example.com");

    expect(result.issues.map((i) => i.id)).not.toContain("product-no-cta");
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.productPageUrl).toBe(PRODUCT_URL);
  });

  // Scenario 6 (documented, not independently re-testable here): a page
  // where JavaScript renders the purchase action after the initial HTML
  // response. The fix for this lives in scraper.ts (scanProductPage uses
  // waitForNetworkIdle: true before capturing content/interactiveElements,
  // see the comment above scanProductPage in index.ts) — by the time
  // scrapeWithContext returns, interactiveElements already reflects the
  // POST-hydration DOM. This test proves the detection layer correctly
  // reads that already-settled state once it's available.
  it("detects a purchase action that only exists after client-side rendering completes", async () => {
    const html = `<html><body><h1>Widget</h1><div class="price">$49.99</div></body></html>`;
    const $ = cheerio.load(html);
    vi.mocked(scrapeWithContext).mockResolvedValueOnce({
      html,
      $,
      title: "Widget",
      metaDescription: "",
      h1s: ["Widget"],
      h2s: [],
      images: [],
      links: [],
      hasSSL: true,
      statusCode: 200,
      responseTimeMs: 100,
      screenshotDataUrl: null,
      // Represents the settled, post-hydration DOM state that
      // waitForNetworkIdle is what makes scrapeWithContext actually return.
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
      evidenceComplete: true,
    });

    const result = await scanProductPage({} as never, makeHomepage(), "https://example.com");

    expect(result.issues.map((i) => i.id)).not.toContain("product-no-cta");
  });
});
