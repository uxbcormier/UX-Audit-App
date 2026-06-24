import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { estimateAnnualRevenueLoss } from "../revenue";

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
      signal: "Add-to-Cart Friction",
      severity: "critical",
      title: "No 'Add to Cart' button found on product page",
      observation: `No 'Add to Cart' or 'Buy Now' action was found on a product page (${productUrl}).`,
      behavioralExplanation:
        "Shoppers who click through to a specific product expect exactly one obvious next step; without it, interest has nowhere to go.",
      businessImplication: "A visitor who can't find how to buy leaves, no matter how interested they were a moment earlier.",
      estimatedImpact: "+6–10% conversion",
      fix: "Make sure every product page has a clearly labeled 'Add to Cart' or 'Buy Now' button.",
      revenueLossEstimate: estimateAnnualRevenueLoss(6, 10),
      confidence: "medium",
      effort: "low",
    });
  }

  const hasReviews =
    REVIEW_PATTERN.test(html) || $('[class*="review"], [class*="rating"], [class*="star"]').length > 0;

  if (!hasReviews) {
    issues.push({
      id: "product-no-reviews",
      category: "UX",
      signal: "Trust Reinforcement",
      severity: "high",
      title: "No reviews or ratings on product page",
      observation: `No ratings or reviews were found on a product page (${productUrl}).`,
      behavioralExplanation:
        "Shoppers look for proof other buyers were satisfied with this specific item, not just the brand in general, right before deciding to buy it.",
      businessImplication: "Product-level social proof is one of the strongest levers on add-to-cart rate; its absence directly weakens purchase confidence.",
      estimatedImpact: "+2–4% conversion",
      fix: "Add a star rating and review count directly on each product page.",
      revenueLossEstimate: estimateAnnualRevenueLoss(2, 4),
      confidence: "medium",
      effort: "medium",
    });
  }

  const hasShippingInfo = SHIPPING_PATTERN.test(html);
  if (!hasShippingInfo) {
    issues.push({
      id: "product-no-shipping-info",
      category: "UX",
      signal: "Trust Reinforcement",
      severity: "warning",
      title: "No shipping or delivery information on product page",
      observation: `No mention of shipping cost or delivery timing was found on a product page (${productUrl}).`,
      behavioralExplanation:
        "Shoppers weighing a purchase want to know when it'll arrive and what shipping will cost before they commit, not after they've started checkout.",
      businessImplication: "Surprise shipping costs or timing discovered later in checkout is one of the most common reasons carts are abandoned.",
      estimatedImpact: "+2–4% conversion",
      fix: "Show estimated delivery time and shipping cost (or a 'free shipping over $X' note) directly on the product page.",
      revenueLossEstimate: estimateAnnualRevenueLoss(2, 4),
      confidence: "medium",
      effort: "low",
    });
  }

  return issues;
}
