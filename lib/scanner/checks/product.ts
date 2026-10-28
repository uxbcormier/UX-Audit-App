import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";
import { normalizedBodyText } from "../normalize";
import { classifyPage, type PageClassification } from "../pageClassification";
import { detectPurchaseAction } from "../purchaseAction";

const SHIPPING_PATTERN = /shipping|ships? (within|in)|delivery|estimated arrival|delivered by/i;
const REVIEW_PATTERN = /review|rating|stars?|testimonial|verified buyer/i;

export function runProductChecks(
  page: ScrapedPage,
  productUrl: string,
  classification: PageClassification = classifyPage(page, productUrl)
): { issues: AuditIssue[]; limitations: string[] } {
  const issues: AuditIssue[] = [];
  const limitations: string[] = [];
  const { $ } = page;
  const text = normalizedBodyText(page);

  // The add-to-cart/purchase-action check is the one that produced the
  // real-world false positive this module exists to prevent (a confident
  // "critical: missing" claim on a page where the button genuinely existed,
  // just gated behind a size selection). It now goes through a structured
  // detector that distinguishes "confirmed absent" from every case where the
  // evidence doesn't actually support that — see purchaseAction.ts for the
  // full gating rationale.
  const purchaseAction = detectPurchaseAction(page, classification);

  if (purchaseAction.status === "not_detected") {
    issues.push({
      id: "product-no-cta",
      category: "UX",
      metric: "PDP Purchase Readiness",
      severity: "critical",
      title: "No purchase action found on product page",
      observation: `No 'Add to Cart', 'Buy Now', or variant-selection action was found on a product page (${productUrl}).`,
      evidence: {
        type: "element-presence",
        detail: purchaseAction.evidence.join(" "),
        value: 0,
      },
      behavioralExplanation:
        "Shoppers who click through to a specific product expect exactly one obvious next step; without it, interest has nowhere to go.",
      businessImplication: "A visitor who can't find how to buy can leave, no matter how interested they were a moment earlier.",
      businessImpact: "high",
      confidence: purchaseAction.confidence,
      effort: "low",
      recommendation: "Make sure every product page has a clearly labeled 'Add to Cart' or 'Buy Now' button.",
      sourceLabel: "observed",
      researchContext: cite("nngHeuristics"),
    });
  } else if (purchaseAction.status === "unable_to_verify") {
    // Never presented as a defect — this is a disclosed gap in what the
    // scan could confirm, not a claim about the site's UX.
    limitations.push(
      `Could not conclusively verify the presence of a purchase-action button on the product page (${productUrl}): ${purchaseAction.evidence.join(" ")}`
    );
  }
  // "present" and "present_but_disabled" (awaiting a required variant pick,
  // which is normal, expected behavior) both mean no issue is raised.

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

  return { issues, limitations };
}
