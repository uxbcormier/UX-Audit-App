import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";
import { classifyPage, guessUrlPriority } from "../pageClassification";

function makePage(html: string): ScrapedPage {
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: $("title").text().trim(),
    metaDescription: "",
    h1s: $("h1").map((_, el) => $(el).text().trim()).get(),
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
  };
}

describe("classifyPage — new page types", () => {
  it("classifies a /search URL as search", () => {
    const page = makePage(`<html><body><h1>Results</h1></body></html>`);
    expect(classifyPage(page, "https://example.com/search?q=boots").pageType).toBe("search");
  });

  it("classifies an about-us URL as about", () => {
    const page = makePage(`<html><body><h1>Our story</h1></body></html>`);
    expect(classifyPage(page, "https://example.com/pages/about-us").pageType).toBe("about");
  });

  it("classifies a contact-us URL as contact", () => {
    const page = makePage(`<html><body><h1>Contact</h1></body></html>`);
    expect(classifyPage(page, "https://example.com/contact-us").pageType).toBe("contact");
  });

  it("classifies a shipping-policy URL as shipping-returns", () => {
    const page = makePage(`<html><body><h1>Shipping</h1></body></html>`);
    expect(classifyPage(page, "https://example.com/policies/shipping-policy").pageType).toBe(
      "shipping-returns"
    );
  });

  it("classifies an FAQ URL as faq", () => {
    const page = makePage(`<html><body><h1>FAQ</h1></body></html>`);
    expect(classifyPage(page, "https://example.com/pages/faq").pageType).toBe("faq");
  });
});

describe("guessUrlPriority", () => {
  it("never prioritizes a checkout URL for crawling", () => {
    expect(guessUrlPriority("https://example.com/checkout", "Checkout")).toBe("checkout");
  });

  it("guesses product from the URL path", () => {
    expect(guessUrlPriority("https://example.com/products/widget", "Widget")).toBe("product");
  });

  it("guesses collection from the URL path", () => {
    expect(guessUrlPriority("https://example.com/collections/jackets", "Jackets")).toBe("collection");
  });

  it("falls back to link text when the URL path is ambiguous", () => {
    expect(guessUrlPriority("https://example.com/p/12345", "Contact us")).toBe("contact");
  });

  it("returns unknown for a URL with no recognizable signal", () => {
    expect(guessUrlPriority("https://example.com/random-slug-xyz", "Random")).toBe("unknown");
  });
});
