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

export type SiteType = "ecommerce" | "general";

// Whether this is a product-catalog ecommerce store at all, vs. a service,
// booking, or informational site (a consultancy, Airbnb/Uber-style
// marketplace, hotel/rental site, SaaS marketing page, etc). This gates
// which checks even apply — a site with no cart/checkout model shouldn't be
// marked down for lacking "Add to Cart" buttons or payment icons, any more
// than an ecommerce store should be judged by booking-flow conventions it
// was never going to have.
//
// Deliberately conservative: a real discovered product page is decisive on
// its own; short of that, it takes multiple independent signals (price
// density AND a cart/shop link) rather than one, since a single stray
// dollar sign or a "shop our story" nav link shouldn't flip the
// classification.
export function classifySiteType(homepage: ScrapedPage, productPageFound: boolean): SiteType {
  if (productPageFound) return "ecommerce";

  const bodyText = homepage.$("body").text();
  const priceCount = (bodyText.match(PRICE_PATTERN) ?? []).length;
  const hasCartSignal = homepage.links.some(
    (l) => CART_PATH_PATTERN.test(l.href) || /\b(cart|bag)\b/i.test(l.text)
  );
  const hasShopSignal = homepage.links.some((l) => SHOP_PATH_PATTERN.test(l.href));

  if (priceCount >= 3 && (hasCartSignal || hasShopSignal)) {
    return "ecommerce";
  }

  return "general";
}
