import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";

const PRICE_PATTERN = /\$\s?\d[\d,]*(\.\d{2})?/g;
const ADD_TO_CART_PATTERN = /add to (cart|bag|basket)|buy now/i;
const SHIPPING_PATTERN = /shipping|delivery|estimated arrival|delivered by/i;
const REVIEW_PATTERN = /review|rating|stars?|testimonial|verified buyer/i;

// A page with zero prices is probably a listing/about/blog page that just
// happens to match the URL pattern; a page with many is probably a
// collection grid. A genuine single-product page reads somewhere in between.
export function looksLikeSingleProductPage(page: ScrapedPage): boolean {
  const bodyText = page.$("body").text();
  const matches = bodyText.match(PRICE_PATTERN);
  const count = matches ? matches.length : 0;
  return count >= 1 && count <= 4;
}

export function runProductChecks(page: ScrapedPage, productUrl: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { $, html } = page;

  const hasAddToCart = $("a, button")
    .get()
    .some((el) => ADD_TO_CART_PATTERN.test($(el).text()));

  if (!hasAddToCart) {
    issues.push({
      id: "product-no-cta",
      category: "UX",
      metric: "PDP Purchase Readiness",
      severity: "critical",
      title: "No 'Add to Cart' button found on product page",
      observation: `No 'Add to Cart' or 'Buy Now' action was found on a product page (${productUrl}).`,
      evidence: {
        type: "element-presence",
        detail: "No link or button matched 'add to cart', 'add to bag', 'add to basket', or 'buy now' on the product page.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers who click through to a specific product expect exactly one obvious next step; without it, interest has nowhere to go.",
      businessImplication: "A visitor who can't find how to buy can leave, no matter how interested they were a moment earlier.",
      businessImpact: "high",
      confidence: 70,
      effort: "low",
      recommendation: "Make sure every product page has a clearly labeled 'Add to Cart' or 'Buy Now' button.",
      sourceLabel: "research-supported",
      researchContext: cite("nngHeuristics"),
    });
  }

  const hasReviews =
    REVIEW_PATTERN.test(html) || $('[class*="review"], [class*="rating"], [class*="star"]').length > 0;

  if (!hasReviews) {
    issues.push({
      id: "product-no-reviews",
      category: "UX",
      metric: "PDP Purchase Readiness",
      severity: "high",
      title: "No reviews or ratings on product page",
      observation: `No ratings or reviews were found on a product page (${productUrl}).`,
      evidence: {
        type: "element-presence",
        detail: "No review/rating keywords or review/rating-related class names found on the product page.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers look for proof other buyers were satisfied with this specific item, not just the brand in general, right before deciding to buy it.",
      businessImplication: "Product-level social proof is a strong lever on add-to-cart rate; its absence can weaken purchase confidence.",
      businessImpact: "medium",
      confidence: 70,
      effort: "medium",
      recommendation: "Add a star rating and review count directly on each product page.",
      sourceLabel: "research-supported",
      researchContext: cite("baymardPDP"),
    });
  }

  const hasShippingInfo = SHIPPING_PATTERN.test(html);
  if (!hasShippingInfo) {
    issues.push({
      id: "product-no-shipping-info",
      category: "UX",
      metric: "PDP Purchase Readiness",
      severity: "warning",
      title: "No shipping or delivery information on product page",
      observation: `No mention of shipping cost or delivery timing was found on a product page (${productUrl}).`,
      evidence: {
        type: "element-presence",
        detail: "No shipping, delivery, or arrival-date language found on the product page.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers weighing a purchase want to know when it'll arrive and what shipping will cost before they commit, not after they've started checkout.",
      businessImplication: "Surprise shipping costs or timing discovered later in checkout are among the most commonly cited reasons carts are abandoned.",
      businessImpact: "medium",
      confidence: 75,
      effort: "low",
      recommendation:
        "Show estimated delivery time and shipping cost (or a 'free shipping over $X' note) directly on the product page.",
      sourceLabel: "research-supported",
      researchContext: cite("baymardCheckout"),
    });
  }

  return issues;
}
