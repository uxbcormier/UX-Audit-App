import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";

vi.mock("../sitemap", () => ({ discoverSitemapUrls: vi.fn() }));
vi.mock("../robots", () => ({ fetchRobotsRules: vi.fn() }));

import { discoverPages } from "../discovery";
import { discoverSitemapUrls } from "../sitemap";
import { fetchRobotsRules } from "../robots";

function makeHomepage(links: { href: string; text: string }[]): ScrapedPage {
  const html = `<html><body><h1>Shop</h1></body></html>`;
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: "Shop",
    metaDescription: "",
    h1s: ["Shop"],
    h2s: [],
    images: [],
    links,
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: [],
    headingAudit: { h1Count: 1, visibleH1Count: 1 },
    contrastAudit: null,
    evidenceComplete: true,
  };
}

const BASE_URL = "https://example.com";

function allowAllRobots() {
  vi.mocked(fetchRobotsRules).mockResolvedValue({ sitemapUrls: [], isAllowed: () => true });
}

describe("discoverPages", () => {
  beforeEach(() => {
    vi.mocked(discoverSitemapUrls).mockResolvedValue({ found: false, urls: [] });
    allowAllRobots();
  });

  it("falls back to homepage links when no sitemap exists", async () => {
    const homepage = makeHomepage([
      { href: "/products/widget", text: "Widget" },
      { href: "/about-us", text: "About" },
    ]);
    const result = await discoverPages(homepage, BASE_URL, 10);
    expect(result.sitemapFound).toBe(false);
    expect(result.candidates.map((c) => c.url)).toEqual(
      expect.arrayContaining(["https://example.com/products/widget", "https://example.com/about-us"])
    );
  });

  it("includes sitemap URLs alongside homepage links, deduped", async () => {
    vi.mocked(discoverSitemapUrls).mockResolvedValue({
      found: true,
      urls: ["https://example.com/products/widget", "https://example.com/products/gadget"],
    });
    const homepage = makeHomepage([{ href: "/products/widget", text: "Widget" }]);
    const result = await discoverPages(homepage, BASE_URL, 10);
    expect(result.sitemapFound).toBe(true);
    const urls = result.candidates.map((c) => c.url);
    expect(urls).toContain("https://example.com/products/gadget");
    // widget appears in both sources but only once in candidates
    expect(urls.filter((u) => u === "https://example.com/products/widget")).toHaveLength(1);
  });

  it("never includes a checkout URL in candidates, but reports it separately", async () => {
    const homepage = makeHomepage([{ href: "/checkout", text: "Checkout" }]);
    const result = await discoverPages(homepage, BASE_URL, 10);
    expect(result.candidates.map((c) => c.url)).not.toContain("https://example.com/checkout");
    expect(result.excludedCheckoutUrls).toContain("https://example.com/checkout");
  });

  it("excludes a robots-disallowed path from candidates and reports it separately", async () => {
    vi.mocked(fetchRobotsRules).mockResolvedValue({
      sitemapUrls: [],
      isAllowed: (path: string) => !path.startsWith("/admin"),
    });
    const homepage = makeHomepage([
      { href: "/admin/dashboard", text: "Admin" },
      { href: "/products/widget", text: "Widget" },
    ]);
    const result = await discoverPages(homepage, BASE_URL, 10);
    expect(result.candidates.map((c) => c.url)).not.toContain("https://example.com/admin/dashboard");
    expect(result.disallowedByRobots).toContain("https://example.com/admin/dashboard");
    expect(result.candidates.map((c) => c.url)).toContain("https://example.com/products/widget");
  });

  it("caps total candidates at the given budget", async () => {
    const links = Array.from({ length: 20 }, (_, i) => ({ href: `/products/item-${i}`, text: `Item ${i}` }));
    const homepage = makeHomepage(links);
    const result = await discoverPages(homepage, BASE_URL, 5);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
    expect(result.totalDiscovered).toBe(20);
  });

  it("reserves per-type quota slots so a flood of one type doesn't crowd out variety", async () => {
    const links = [
      ...Array.from({ length: 10 }, (_, i) => ({ href: `/products/item-${i}`, text: `Item ${i}` })),
      { href: "/contact-us", text: "Contact" },
      { href: "/pages/shipping-policy", text: "Shipping" },
    ];
    const homepage = makeHomepage(links);
    const result = await discoverPages(homepage, BASE_URL, 6);
    const types = result.candidates.map((c) => c.priorityHint);
    expect(types).toContain("contact");
    expect(types).toContain("shipping-returns");
    // product quota (4) + contact (1) + shipping-returns (1) = 6, fits exactly
    expect(result.candidates).toHaveLength(6);
  });

  it("records unselected-but-eligible URLs as excludedByBudgetUrls", async () => {
    const links = Array.from({ length: 8 }, (_, i) => ({ href: `/products/item-${i}`, text: `Item ${i}` }));
    const homepage = makeHomepage(links);
    // product quota is 4, so budget of 4 picks exactly the quota and leaves the rest unselected
    const result = await discoverPages(homepage, BASE_URL, 4);
    expect(result.candidates).toHaveLength(4);
    expect(result.excludedByBudgetUrls.length).toBe(4);
  });

  it("ignores an external link entirely (not counted as discovered)", async () => {
    const homepage = makeHomepage([{ href: "https://otherdomain.com/page", text: "External" }]);
    const result = await discoverPages(homepage, BASE_URL, 10);
    expect(result.totalDiscovered).toBe(0);
    expect(result.candidates).toHaveLength(0);
  });
});
