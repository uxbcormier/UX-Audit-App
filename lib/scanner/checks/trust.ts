import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";

export function runTrustChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { html, $ } = page;

  // Trust badges / payment icons
  const hasTrustBadge =
    /paypal|visa|mastercard|amex|secure checkout|ssl secured|money.back|guarantee|norton|mcafee|trustpilot/i.test(html);

  if (!hasTrustBadge) {
    issues.push({
      id: "trust-no-badges",
      category: "Trust",
      metric: "Trust Coverage",
      severity: "high",
      title: "No trust badges or payment icons on the homepage",
      observation: "No security badges, guarantee seals, or payment method icons were detected on the homepage.",
      evidence: {
        type: "element-presence",
        detail: "No payment-method names (Visa, Mastercard, PayPal, Amex) or security/guarantee language found on the homepage.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers forming a first impression of a store look for visible signs it's a legitimate, established business before they explore further; finding none reads as a risk signal, not a neutral absence.",
      businessImplication: "Weaker first-impression trust can mean more visitors bounce before ever reaching a product page or checkout.",
      businessImpact: "medium",
      confidence: 70,
      effort: "low",
      recommendation:
        "Add payment method icons (Visa, Mastercard, PayPal) and a security or guarantee badge near the top of your homepage, and carry them through to checkout.",
      sourceLabel: "research-supported",
      researchContext: cite("trustSignalsGeneral"),
    });
  }

  // Reviews / social proof
  const hasSocialProof =
    /review|rating|stars|testimonial|customer|verified buyer|trustpilot|yotpo|judge\.me|stamped/i.test(html) ||
    $('[class*="review"], [class*="rating"], [class*="star"]').length > 0;

  if (!hasSocialProof) {
    issues.push({
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
      sourceLabel: "research-supported",
      researchContext: cite("trustSignalsGeneral"),
    });
  }

  // Return / refund policy
  const hasReturnPolicy = /return policy|refund|money.back guarantee|free returns|hassle.free/i.test(html);

  if (!hasReturnPolicy) {
    issues.push({
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
    });
  }

  // Privacy policy link
  const hasPrivacy = $('a[href*="privacy"]').length > 0 || /privacy policy/i.test(html);

  if (!hasPrivacy) {
    issues.push({
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
    });
  }

  // About page
  const hasAbout = $('a[href*="about"]').length > 0 || /about us|our story|who we are/i.test(html);

  if (!hasAbout) {
    issues.push({
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
    });
  }

  return issues;
}
