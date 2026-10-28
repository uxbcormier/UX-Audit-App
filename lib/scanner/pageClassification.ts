import type { ScrapedPage } from "./scraper";

// Shared with productDiscovery.ts's own conventions, duplicated rather than
// imported to keep this module dependency-free and usable from any check.
const PRODUCT_PATH_PATTERN = /\/(products?|item|p)\//i;
const SHOP_PATH_PATTERN = /\/(collections?|shop|category|categories|catalog)(\/|$)/i;
const CART_PATH_PATTERN = /\/(cart|basket|bag)(\/|$)/i;
const CHECKOUT_PATH_PATTERN = /\/checkout(\/|$)/i;
const PRICE_PATTERN = /\$\s?\d[\d,]*(\.\d{2})?/g;
const PURCHASE_LANGUAGE_PATTERN =
  /add to (cart|bag|basket)|buy now|select (a |your )?(size|colou?r|variant)/i;

export type PageType = "homepage" | "product" | "collection" | "cart" | "checkout" | "unknown";

export interface PageClassification {
  pageType: PageType;
  confidence: number; // 0-100 — how sure the classifier is, not a check result
}

// A deliberately conservative heuristic classifier, not a certainty. Every
// check that gates a "definitive missing X" finding on page type must also
// check the confidence, not just the pageType label — see purchaseAction.ts.
export function classifyPage(page: ScrapedPage, url: string): PageClassification {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }

  if (CHECKOUT_PATH_PATTERN.test(path)) {
    return { pageType: "checkout", confidence: 90 };
  }
  if (CART_PATH_PATTERN.test(path)) {
    return { pageType: "cart", confidence: 85 };
  }

  const bodyText = page.$("body").text();
  const priceCount = (bodyText.match(PRICE_PATTERN) ?? []).length;

  // Score toward "product page" from several independent signals so no
  // single brittle rule (URL shape alone, or price count alone) decides it.
  let productScore = 0;
  if (PRODUCT_PATH_PATTERN.test(path)) productScore += 40;
  if (priceCount >= 1 && priceCount <= 4) productScore += 35;
  if (page.h1s.length === 1) productScore += 10;
  if (PURCHASE_LANGUAGE_PATTERN.test(bodyText)) productScore += 15;

  const isRootPath = path === "" || path === "/";

  if (productScore >= 50) {
    return { pageType: "product", confidence: Math.min(100, productScore) };
  }
  if (isRootPath) {
    return { pageType: "homepage", confidence: 90 };
  }
  if (SHOP_PATH_PATTERN.test(path) || priceCount > 4) {
    return { pageType: "collection", confidence: 65 };
  }

  return { pageType: "unknown", confidence: 30 };
}
