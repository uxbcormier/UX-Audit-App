import type { ScrapedPage } from "./scraper";

// Shared with productDiscovery.ts's own conventions, duplicated rather than
// imported to keep this module dependency-free and usable from any check.
const PRODUCT_PATH_PATTERN = /\/(products?|item|p)\//i;
const SHOP_PATH_PATTERN = /\/(collections?|shop|category|categories|catalog)(\/|$)/i;
const CART_PATH_PATTERN = /\/(cart|basket|bag)(\/|$)/i;
const CHECKOUT_PATH_PATTERN = /\/checkout(\/|$)/i;
const SEARCH_PATH_PATTERN = /\/search(\/|$)|[?&](q|query|s)=/i;
const ABOUT_PATH_PATTERN = /\/(pages\/)?(about(-us)?|our-story|brand)(\/|$)/i;
const CONTACT_PATH_PATTERN = /\/(pages\/)?contact(-us)?(\/|$)/i;
const SHIPPING_RETURNS_PATH_PATTERN =
  /\/(pages\/)?(policies\/)?(shipping|returns?|refunds?|shipping-returns|shipping-policy|refund-policy)(\/|$)/i;
const FAQ_PATH_PATTERN = /\/(pages\/)?(faq|faqs|help|support)(\/|$)/i;
const PRICE_PATTERN = /\$\s?\d[\d,]*(\.\d{2})?/g;
const PURCHASE_LANGUAGE_PATTERN =
  /add to (cart|bag|basket)|buy now|select (a |your )?(size|colou?r|variant)/i;

export type PageType =
  | "homepage"
  | "product"
  | "collection"
  | "cart"
  | "checkout"
  | "search"
  | "about"
  | "contact"
  | "shipping-returns"
  | "faq"
  | "unknown";

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
  if (SEARCH_PATH_PATTERN.test(url)) {
    return { pageType: "search", confidence: 80 };
  }
  if (ABOUT_PATH_PATTERN.test(path)) {
    return { pageType: "about", confidence: 75 };
  }
  if (CONTACT_PATH_PATTERN.test(path)) {
    return { pageType: "contact", confidence: 75 };
  }
  if (SHIPPING_RETURNS_PATH_PATTERN.test(path)) {
    return { pageType: "shipping-returns", confidence: 75 };
  }
  if (FAQ_PATH_PATTERN.test(path)) {
    return { pageType: "faq", confidence: 70 };
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

// A cheap, pre-fetch guess at page type from the URL and link text alone —
// used only to prioritize which discovered URLs are worth spending the
// crawl budget on (see discovery.ts), never to decide what checks apply or
// to label a ScanPage's final pageType. classifyPage() above (which has the
// actual DOM to look at) is the only authoritative classification; this is
// deliberately simpler and allowed to be wrong; a bad prioritization guess
// costs at most one crawl slot, which is a problem this budget mechanism
// causes everywhere else anyway (10-15 pages is best-effort representative
// sampling by design, not exhaustive coverage).
export type UrlPriorityHint =
  | "product"
  | "collection"
  | "cart"
  | "checkout"
  | "search"
  | "about"
  | "contact"
  | "shipping-returns"
  | "faq"
  | "unknown";

export function guessUrlPriority(url: string, linkText: string): UrlPriorityHint {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  const text = linkText.toLowerCase();

  if (CHECKOUT_PATH_PATTERN.test(path)) return "checkout";
  if (CART_PATH_PATTERN.test(path) || /\b(cart|bag)\b/.test(text)) return "cart";
  if (SEARCH_PATH_PATTERN.test(url)) return "search";
  if (ABOUT_PATH_PATTERN.test(path) || /\babout\b/.test(text)) return "about";
  if (CONTACT_PATH_PATTERN.test(path) || /\bcontact\b/.test(text)) return "contact";
  if (SHIPPING_RETURNS_PATH_PATTERN.test(path) || /\b(shipping|returns?)\b/.test(text)) return "shipping-returns";
  if (FAQ_PATH_PATTERN.test(path) || /\b(faq|help|support)\b/.test(text)) return "faq";
  if (PRODUCT_PATH_PATTERN.test(path)) return "product";
  if (SHOP_PATH_PATTERN.test(path)) return "collection";
  return "unknown";
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
