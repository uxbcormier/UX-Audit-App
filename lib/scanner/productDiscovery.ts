import type { ScrapedPage } from "./scraper";

// Common ecommerce platform URL conventions for a single product page
// (Shopify's /products/, WooCommerce's /product/, Squarespace's /p/, etc).
const PRODUCT_PATH_PATTERN = /\/(products?|item|p)\//i;

// Category/collection index conventions, used as a fallback hop when no
// product link is visible directly on the homepage.
const SHOP_PATH_PATTERN = /\/(collections?|shop|category|categories|catalog)(\/|$)/i;

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

// Picks the first link matching a product URL convention — good enough for
// a representative sample page, not trying to find "the best" product.
export function findProductLink(page: ScrapedPage, baseUrl: string): string | null {
  for (const link of page.links) {
    if (!link.href || !PRODUCT_PATH_PATTERN.test(link.href)) continue;
    const resolved = resolveUrl(link.href, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

export function findShopLink(page: ScrapedPage, baseUrl: string): string | null {
  for (const link of page.links) {
    if (!link.href || !SHOP_PATH_PATTERN.test(link.href)) continue;
    const resolved = resolveUrl(link.href, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}
