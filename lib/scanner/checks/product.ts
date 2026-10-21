import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";
import { normalizedBodyText } from "../normalize";

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
  const { $ } = page;
  const text = normalizedBodyText(page);

  // Real storefronts often split a button's label across nested <span>
  // elements for styling, so the concatenated .text() can come back as
  // "Add\n          to\n          Bag" instead of "Add to Bag" — a literal
  // single-space regex like ours would wrongly call that a miss. Collapse
  // whitespace before matching so markup structure can't produce a false
  // negative. Also check common non-<button>/<a> interactive patterns
  // (role="button", <input type="submit">, custom elements with a "cart"/
  // "bag"/"buy" class or attribute) and aria-label, since many component
  // libraries hide the actual action text there instead of in visible text.
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

  const candidateEls = $(
    'a, button, input[type="submit"], input[type="button"], [role="button"], [class*="add-to-cart" i], [class*="add-to-bag" i], [data-testid*="add-to-cart" i], [data-testid*="add-to-bag" i]'
  ).get();

  const hasAddToCartElement = candidateEls.some((el) => {
    const $el = $(el);
    const label = normalize(
      [$el.text(), $el.attr("aria-label") ?? "", $el.attr("value") ?? ""].join(" ")
    );
    return ADD_TO_CART_PATTERN.test(label);
  });

  // Last-resort fallback: if no matching element was found but the phrase
  // genuinely appears on the page (normalized), treat it as present rather
  // than claim a confirmed absence we can't actually stand behind — a
  // structurally unusual button (framework-specific custom element we
  // don't recognize) is far more likely than a product page that merely
  // mentions "add to cart" without an action behind it.
  const hasAddToCartInText = ADD_TO_CART_PATTERN.test(normalize($("body").text()));
  const hasAddToCart = hasAddToCartElement || hasAddToCartInText;

  if (!hasAddToCart) {
    // Temporary diagnostic: the regex/wait-timing fixes applied so far
    // haven't resolved a real-world false negative on this exact check, so
    // log what the scraper actually captured to find the true cause instead
    // of guessing again. Safe to remove once the real cause is confirmed.
    console.log(
      JSON.stringify({
        diagnostic: "product-no-cta",
        productUrl,
        candidateElCount: candidateEls.length,
        bodyTextLength: text.length,
        containsBagWord: /bag/i.test(text),
        containsCartWord: /cart/i.test(text),
        containsBuyWord: /buy/i.test(text),
        bodyTextSample: text.slice(0, 4000),
      })
    );
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
    REVIEW_PATTERN.test(text) || $('[class*="review"], [class*="rating"], [class*="star"]').length > 0;

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

  const hasShippingInfo = SHIPPING_PATTERN.test(text);
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
