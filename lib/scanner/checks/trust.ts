import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";
import { normalizedBodyText } from "../normalize";

// Every "no X found" check below shares the same false-negative risk the
// Add to Cart bug exposed: an incomplete DOM capture can't prove something
// doesn't exist on the real page, only that it wasn't in what was captured.
// When page.evidenceComplete is false, these push a disclosed limitation
// instead of a confident defect claim.
function emitAbsenceFinding(
  page: ScrapedPage,
  issues: AuditIssue[],
  limitations: string[],
  limitationNote: string,
  issue: AuditIssue
): void {
  if (!page.evidenceComplete) {
    limitations.push(limitationNote);
    return;
  }
  issues.push(issue);
}

const PAYMENT_BRAND_PATTERN = /paypal|visa|mastercard|master card|amex|american express|apple pay|google pay|shop pay|klarna|afterpay|affirm/i;

// Payment-method icons are almost always <img>/<svg> elements, not visible
// text — a brand's accessible name lives in alt="" or aria-label/<title>,
// which plain body-text matching never sees at all. Matching only against
// page.$("body").text() (the previous implementation) meant any store using
// actual logo images — the overwhelming majority of real storefronts — was
// structurally invisible to this check, regardless of whether the icons
// were really there. This was a genuine false-negative source, not just an
// evidence-completeness timing issue.
function hasPaymentIconEvidence(page: ScrapedPage, text: string): boolean {
  const { $ } = page;

  if (PAYMENT_BRAND_PATTERN.test(text)) return true;

  const hasMatchingImgAlt = $("img").toArray().some((el) => {
    const alt = $(el).attr("alt") ?? "";
    return PAYMENT_BRAND_PATTERN.test(alt);
  });
  if (hasMatchingImgAlt) return true;

  const hasMatchingSvg = $("svg").toArray().some((el) => {
    const $el = $(el);
    const label = [
      $el.attr("aria-label") ?? "",
      $el.find("title").first().text() ?? "",
      $el.attr("class") ?? "",
    ].join(" ");
    return PAYMENT_BRAND_PATTERN.test(label);
  });
  if (hasMatchingSvg) return true;

  // Common payment-icon container conventions even when the specific brand
  // name isn't in any attribute we can read (e.g. a sprite-sheet icon font).
  return $(
    '[class*="payment-icon" i], [class*="payment-method" i], [class*="payment-badge" i], [data-testid*="payment" i]'
  ).length > 0;
}

export function runTrustChecks(page: ScrapedPage): { issues: AuditIssue[]; limitations: string[] } {
  const issues: AuditIssue[] = [];
  const limitations: string[] = [];
  const { $ } = page;
  const text = normalizedBodyText(page);

  // Payment-method icons — independent from the security/guarantee check
  // below, since a store can legitimately have one without the other, and
  // conflating them (as the old single "trust badges" check did) produced a
  // less specific, harder-to-act-on finding.
  if (!hasPaymentIconEvidence(page, text)) {
    emitAbsenceFinding(
      page,
      issues,
      limitations,
      "Could not conclusively verify whether payment-method icons are present on the homepage — the page's DOM capture was incomplete for this scan.",
      {
        id: "trust-no-payment-icons",
        category: "Trust",
        metric: "Trust Coverage",
        severity: "low",
        title: "No payment-method icons detected on the homepage",
        observation:
          "No payment-method icons (as images, SVGs, or brand names) were detected on the homepage. Many stores only show these in the footer, at checkout, or not at all, so this is not necessarily a defect.",
        evidence: {
          type: "element-presence",
          detail:
            "No payment-brand names matched in visible text, <img alt>, <svg> labels/titles, or common payment-icon class/data-testid patterns on the homepage.",
          value: 0,
        },
        behavioralExplanation:
          "Some first-time shoppers look for recognizable payment logos as a quick legitimacy check, though many stores convert well without displaying them on the homepage specifically.",
        businessImplication: "This is an optional trust signal, not a confirmed defect — consider it alongside your actual checkout page, which wasn't inspected by this scan.",
        businessImpact: "low",
        confidence: 60,
        effort: "low",
        recommendation:
          "Consider adding payment-method icons (Visa, Mastercard, PayPal) near your primary CTA or in the footer, if you don't already show them at checkout.",
        sourceLabel: "internal-heuristic",
      }
    );
  }

  // Security / guarantee language — kept separate from payment icons (see
  // above). Text-based: these are near-universally phrases, not icons.
  const hasSecurityClaim = /secure checkout|ssl secured|money.back|guarantee|norton|mcafee/i.test(text);

  if (!hasSecurityClaim) {
    emitAbsenceFinding(
      page,
      issues,
      limitations,
      "Could not conclusively verify whether security or guarantee language is present on the homepage — the page's DOM capture was incomplete for this scan.",
      {
        id: "trust-no-security-claim",
        category: "Trust",
        metric: "Trust Coverage",
        severity: "low",
        title: "No security or guarantee language found on the homepage",
        observation: "No 'secure checkout', satisfaction-guarantee, or similar reassurance language was found on the homepage.",
        evidence: {
          type: "element-presence",
          detail: "No security-badge or guarantee-language phrases found in the homepage's visible text.",
          value: 0,
        },
        behavioralExplanation:
          "Shoppers weighing whether to hand over payment details sometimes look for a brief, explicit reassurance before committing.",
        businessImplication: "An optional reassurance signal, not a confirmed defect on its own.",
        businessImpact: "low",
        confidence: 65,
        effort: "low",
        recommendation: "Consider a short reassurance line ('Secure checkout', 'Free returns') near your primary CTA.",
        sourceLabel: "internal-heuristic",
      }
    );
  }

  // Reviews / social proof
  const hasSocialProof =
    /review|rating|stars|testimonial|customer|verified buyer|trustpilot|yotpo|judge\.me|stamped/i.test(text) ||
    $('[class*="review"], [class*="rating"], [class*="star"]').length > 0;

  if (!hasSocialProof) {
    emitAbsenceFinding(
      page,
      issues,
      limitations,
      "Could not conclusively verify whether customer reviews or social proof are present on the homepage — the page's DOM capture was incomplete for this scan.",
      {
      id: "trust-no-reviews",
      category: "Trust",
      metric: "Trust Coverage",
      severity: "high",
      title: "No customer reviews or social proof detected",
      observation: "No ratings, reviews, or testimonials appear on the homepage.",
      evidence: {
        type: "element-presence",
        detail: "No review, rating, or testimonial keywords or related class names found on the homepage.",
        value: 0,
      },
      behavioralExplanation:
        "Without proof other people bought and were satisfied, shoppers have only the brand's own claims to go on — which carries far less weight.",
      businessImplication: "Most shoppers read reviews before buying; their absence can weaken purchase confidence.",
      businessImpact: "medium",
      confidence: 70,
      effort: "medium",
        recommendation: "Add a reviews section or star ratings on your homepage and product pages.",
        sourceLabel: "internal-heuristic",
      }
    );
  }

  // Return / refund policy
  const hasReturnPolicy = /return policy|refund|money.back guarantee|free returns|hassle.free/i.test(text);

  if (!hasReturnPolicy) {
    emitAbsenceFinding(
      page,
      issues,
      limitations,
      "Could not conclusively verify whether a return/refund policy is mentioned on the homepage — the page's DOM capture was incomplete for this scan.",
      {
      id: "trust-no-return-policy",
      category: "Trust",
      metric: "Trust Coverage",
      severity: "warning",
      title: "Return policy not visible on homepage",
      observation: "No mention of a return or refund policy appears on the main page.",
      evidence: {
        type: "element-presence",
        detail: "No return/refund policy language found on the homepage.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers weighing a purchase they can't physically inspect first treat an unclear return path as added risk, and risk suppresses intent to buy.",
      businessImplication: "Clear return terms can increase willingness to complete a purchase.",
      businessImpact: "medium",
      confidence: 75,
      effort: "low",
        recommendation: "Add a return policy callout ('Free 30-day returns') near the CTA or in the header.",
        sourceLabel: "research-supported",
        researchContext: cite("baymardCheckout"),
      }
    );
  }

  // Privacy policy link
  const hasPrivacy = $('a[href*="privacy"]').length > 0 || /privacy policy/i.test(text);

  if (!hasPrivacy) {
    emitAbsenceFinding(
      page,
      issues,
      limitations,
      "Could not conclusively verify whether a privacy policy link is present on the homepage — the page's DOM capture was incomplete for this scan.",
      {
      id: "trust-no-privacy",
      category: "Trust",
      metric: "Trust Coverage",
      severity: "warning",
      title: "No privacy policy link found",
      observation: "No privacy policy link was found in the page.",
      evidence: {
        type: "element-presence",
        detail: "No link to a privacy policy and no 'privacy policy' text found.",
        value: 0,
      },
      behavioralExplanation:
        "Privacy-conscious shoppers look for this link as a baseline legitimacy check before entering personal or payment data.",
      businessImplication: "Missing privacy policies can also block ad accounts and create compliance exposure under GDPR/CCPA.",
      businessImpact: "low",
      confidence: 85,
      effort: "low",
        recommendation: "Add a privacy policy link to your footer and ensure it covers data collection.",
        sourceLabel: "internal-heuristic",
      }
    );
  }

  // About page
  const hasAbout = $('a[href*="about"]').length > 0 || /about us|our story|who we are/i.test(text);

  if (!hasAbout) {
    emitAbsenceFinding(
      page,
      issues,
      limitations,
      "Could not conclusively verify whether an About Us link is present on the homepage — the page's DOM capture was incomplete for this scan.",
      {
      id: "trust-no-about",
      category: "Trust",
      metric: "Trust Coverage",
      severity: "low",
      title: "No 'About Us' link found",
      observation: "No About page or brand story link was found in navigation or footer.",
      evidence: {
        type: "element-presence",
        detail: "No About/brand-story link or language found in navigation or footer.",
        value: 0,
      },
      behavioralExplanation:
        "First-time visitors size up whether a brand is real before buying from it, and an About page is often the page they check.",
      businessImplication: "Brand story pages can build credibility that lifts conversion for unfamiliar shoppers.",
      businessImpact: "low",
      confidence: 80,
      effort: "low",
        recommendation: "Add an 'About Us' page link in your navigation or footer.",
        sourceLabel: "internal-heuristic",
      }
    );
  }

  return { issues, limitations };
}
