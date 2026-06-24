import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { estimateAnnualRevenueLoss } from "../revenue";

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
      signal: "Trust Reinforcement",
      severity: "high",
      title: "No trust badges or payment icons on the homepage",
      observation: "No security badges, guarantee seals, or payment method icons were detected on the homepage.",
      behavioralExplanation:
        "Shoppers forming a first impression of a store look for visible signs it's a legitimate, established business before they explore further; finding none reads as a risk signal, not a neutral absence.",
      businessImplication: "Weaker first-impression trust means more visitors bounce before ever reaching a product page or checkout.",
      estimatedImpact: "+3–6% checkout completion",
      fix: "Add payment method icons (Visa, Mastercard, PayPal) and a security or guarantee badge near the top of your homepage, and carry them through to checkout.",
      revenueLossEstimate: estimateAnnualRevenueLoss(3, 6),
      confidence: "medium",
      effort: "low",
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
      signal: "Trust Reinforcement",
      severity: "high",
      title: "No customer reviews or social proof detected",
      observation: "No ratings, reviews, or testimonials appear on the homepage.",
      behavioralExplanation:
        "Without proof other people bought and were satisfied, shoppers have only the brand's own claims to go on — which carries far less weight.",
      businessImplication: "Roughly 9 in 10 shoppers read reviews before buying; their absence directly weakens purchase confidence.",
      estimatedImpact: "+4–6% conversion",
      fix: "Add a reviews section or star ratings on your homepage and product pages.",
      revenueLossEstimate: estimateAnnualRevenueLoss(4, 6),
      confidence: "medium",
      effort: "medium",
    });
  }

  // Return / refund policy
  const hasReturnPolicy =
    /return policy|refund|money.back guarantee|free returns|hassle.free/i.test(html);

  if (!hasReturnPolicy) {
    issues.push({
      id: "trust-no-return-policy",
      category: "Trust",
      signal: "Trust Reinforcement",
      severity: "warning",
      title: "Return policy not visible on homepage",
      observation: "No mention of a return or refund policy appears on the main page.",
      behavioralExplanation:
        "Shoppers weighing a purchase they can't physically inspect first treat an unclear return path as added risk, and risk suppresses intent to buy.",
      businessImplication: "Clear return terms measurably increase willingness to complete a purchase.",
      estimatedImpact: "+2–4% conversion",
      fix: "Add a return policy callout ('Free 30-day returns') near the CTA or in the header.",
      revenueLossEstimate: estimateAnnualRevenueLoss(2, 4),
      confidence: "medium",
      effort: "low",
    });
  }

  // Privacy policy link
  const hasPrivacy =
    $('a[href*="privacy"]').length > 0 || /privacy policy/i.test(html);

  if (!hasPrivacy) {
    issues.push({
      id: "trust-no-privacy",
      category: "Trust",
      signal: "Trust Reinforcement",
      severity: "warning",
      title: "No privacy policy link found",
      observation: "No privacy policy link was found in the page.",
      behavioralExplanation:
        "Privacy-conscious shoppers look for this link as a baseline legitimacy check before entering personal or payment data.",
      businessImplication: "Missing privacy policies can also block ad accounts and create compliance exposure under GDPR/CCPA.",
      estimatedImpact: "+0.5–1.5% checkout completion",
      fix: "Add a privacy policy link to your footer and ensure it covers data collection.",
      revenueLossEstimate: estimateAnnualRevenueLoss(0.5, 1.5),
      confidence: "high",
      effort: "low",
    });
  }

  // About page
  const hasAbout =
    $('a[href*="about"]').length > 0 || /about us|our story|who we are/i.test(html);

  if (!hasAbout) {
    issues.push({
      id: "trust-no-about",
      category: "Trust",
      signal: "Trust Reinforcement",
      severity: "low",
      title: "No 'About Us' link found",
      observation: "No About page or brand story link was found in navigation or footer.",
      behavioralExplanation:
        "First-time visitors size up whether a brand is real before buying from it, and an About page is often the page they check.",
      businessImplication: "Brand story pages build credibility that measurably lifts conversion for unfamiliar shoppers.",
      estimatedImpact: "+0.5–1% conversion",
      fix: "Add an 'About Us' page link in your navigation or footer.",
      revenueLossEstimate: estimateAnnualRevenueLoss(0.5, 1),
      confidence: "medium",
      effort: "low",
    });
  }

  return issues;
}
