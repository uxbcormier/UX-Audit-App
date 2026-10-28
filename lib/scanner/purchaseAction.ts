import type { ScrapedPage } from "./scraper";
import type { PageClassification } from "./pageClassification";

// A deliberately small, explicit vocabulary of outcomes — no boolean ever
// stood in for "we don't know." `not_detected` is the ONLY status that may
// drive a definitive "missing purchase action" finding, and only when it
// was reached with real, complete evidence and a confident page
// classification (see the gating logic in checks/product.ts).
export type PurchaseActionStatus =
  | "present"
  | "present_but_disabled"
  | "not_detected"
  | "not_applicable"
  | "unable_to_verify";

export interface PurchaseActionResult {
  status: PurchaseActionStatus;
  confidence: number; // 0-100
  evidence: string[];
}

const ADD_TO_CART_PATTERN = /add to (cart|bag|basket)|buy now/i;
// Many apparel/footwear PDPs (Canada Goose among them) gate the literal
// "Add to Bag" label behind a variant choice: the primary CTA reads
// "Select Size" (or color/variant) until the shopper picks one. That's a
// standard, functioning purchase path, not a missing one.
const VARIANT_SELECT_PATTERN =
  /select (a |your )?(size|colou?r|variant|option)|choose (a |your )?(size|colou?r)|select options/i;
// Buttons that commonly sit right next to a real purchase action but are
// NOT one — must not be mistaken for it even though some share words
// ("size guide" contains "size"; "add to wishlist" contains "add to").
const EXCLUDED_LABEL_PATTERN =
  /wishlist|save for later|quick view|quickview|size guide|size chart|find in store|notify me|compare|share|zoom|add to registry|subscribe/i;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isPurchaseLabel(label: string): boolean {
  if (!label) return false;
  const isAddToCart = ADD_TO_CART_PATTERN.test(label);
  const isVariantSelect = VARIANT_SELECT_PATTERN.test(label);
  if (!isAddToCart && !isVariantSelect) return false;
  // Let an excluded-sounding label through only if it's an unambiguous
  // add-to-cart phrase — otherwise "Size Guide" would count as a variant
  // selector it isn't.
  if (EXCLUDED_LABEL_PATTERN.test(label) && !isAddToCart) return false;
  return true;
}

// Detects whether a confidently-classified product page has a working path
// to purchase. Never clicks anything, never submits anything — read-only
// inspection of rendered DOM state only.
export function detectPurchaseAction(
  page: ScrapedPage,
  classification: PageClassification
): PurchaseActionResult {
  if (classification.pageType !== "product") {
    return {
      status: "not_applicable",
      confidence: classification.confidence,
      evidence: [
        `Page classified as "${classification.pageType}", not a product detail page — this check doesn't apply here.`,
      ],
    };
  }

  // Real in-browser element evidence (computed visibility + computed
  // disabled state, read live from the rendered page) is strongly
  // preferred over static HTML guessing — see scraper.ts.
  if (page.interactiveElements) {
    const matches = page.interactiveElements
      .map((el) => ({
        el,
        label: normalize([el.text, el.ariaLabel ?? ""].join(" ")),
      }))
      .filter(({ label }) => isPurchaseLabel(label));

    if (matches.length > 0) {
      const visibleEnabled = matches.filter((m) => m.el.visible && !m.el.disabled);
      if (visibleEnabled.length > 0) {
        return {
          status: "present",
          confidence: 95,
          evidence: visibleEnabled.slice(0, 3).map((m) => `<${m.el.tag}> "${m.label}" — visible, enabled`),
        };
      }

      const visibleDisabled = matches.filter((m) => m.el.visible && m.el.disabled);
      if (visibleDisabled.length > 0) {
        return {
          status: "present_but_disabled",
          confidence: 90,
          evidence: visibleDisabled
            .slice(0, 3)
            .map((m) => `<${m.el.tag}> "${m.label}" — visible, disabled (likely awaiting a required variant selection)`),
        };
      }

      // Matching element(s) exist but none are visibly rendered — could be
      // a hidden duplicate for another breakpoint, or markup not yet
      // settled. Either way, not a confirmed absence.
      return {
        status: "unable_to_verify",
        confidence: 40,
        evidence: matches.slice(0, 3).map((m) => `<${m.el.tag}> "${m.label}" — found in DOM but not visibly rendered`),
      };
    }

    // No matching element anywhere in the real, complete DOM inventory.
    // With live evidence and a confident product-page classification,
    // this is the one case a definitive "not detected" is warranted.
    if (classification.confidence >= 50) {
      return {
        status: "not_detected",
        confidence: Math.min(90, classification.confidence + 10),
        evidence: [
          `Inspected ${page.interactiveElements.length} interactive elements on the page; none matched a purchase action ("add to cart/bag/basket", "buy now") or a variant-selection CTA ("select size", "select color").`,
        ],
      };
    }

    return {
      status: "unable_to_verify",
      confidence: 35,
      evidence: [
        "No purchase-action element found, but page-type classification confidence was too low to treat this as a confirmed absence.",
      ],
    };
  }

  // Real browser evidence wasn't available (the in-page evaluation failed).
  // Fall back to the static HTML snapshot with reduced confidence, and never
  // emit a definitive "not detected" from this path alone — a static
  // snapshot can't distinguish "absent" from "not yet rendered."
  const $ = page.$;
  const candidateEls = $(
    'a, button, input[type="submit"], input[type="button"], [role="button"], [class*="add-to-cart" i], [class*="add-to-bag" i], [data-testid*="add-to-cart" i], [data-testid*="add-to-bag" i]'
  ).get();

  const elementMatch = candidateEls.some((el) => {
    const $el = $(el);
    const label = normalize([$el.text(), $el.attr("aria-label") ?? "", $el.attr("value") ?? ""].join(" "));
    return isPurchaseLabel(label);
  });

  const bodyTextMatch = isPurchaseLabel(normalize($("body").text()));

  if (elementMatch || bodyTextMatch) {
    return {
      status: "present",
      confidence: 60,
      evidence: [
        "Matched purchase-action language in the static HTML snapshot (real browser element inventory was unavailable for this scan).",
      ],
    };
  }

  return {
    status: "unable_to_verify",
    confidence: 30,
    evidence: [
      "Real browser element inventory was unavailable for this scan, and no purchase-action language was found in the static HTML snapshot — not enough evidence to confirm or rule out a purchase action.",
    ],
  };
}
