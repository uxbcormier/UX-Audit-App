import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";

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
      severity: "high",
      title: "No trust badges or payment icons",
      description: "No trust signals (SSL badge, payment icons, security seals) detected on the page.",
      impact: "17% of shoppers abandon checkout because they don't trust the site with their card.",
      fix: "Add payment method icons (Visa, Mastercard, PayPal) and a security badge near the CTA and checkout.",
      revenueLossEstimate: 3500,
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
      severity: "high",
      title: "No customer reviews or social proof detected",
      description: "Your homepage shows no ratings, reviews, or testimonials.",
      impact: "92% of shoppers read reviews before buying. No reviews = no trust.",
      fix: "Add a reviews section or star ratings on your homepage and product pages.",
      revenueLossEstimate: 4500,
    });
  }

  // Return / refund policy
  const hasReturnPolicy =
    /return policy|refund|money.back guarantee|free returns|hassle.free/i.test(html);

  if (!hasReturnPolicy) {
    issues.push({
      id: "trust-no-return-policy",
      category: "Trust",
      severity: "warning",
      title: "Return policy not visible on homepage",
      description: "No mention of your return or refund policy on the main page.",
      impact: "Shoppers are 40% more likely to buy when returns are clearly communicated.",
      fix: "Add a return policy callout ('Free 30-day returns') near the CTA or in the header.",
      revenueLossEstimate: 2000,
    });
  }

  // Privacy policy link
  const hasPrivacy =
    $('a[href*="privacy"]').length > 0 || /privacy policy/i.test(html);

  if (!hasPrivacy) {
    issues.push({
      id: "trust-no-privacy",
      category: "Trust",
      severity: "warning",
      title: "No privacy policy link found",
      description: "A privacy policy link is required by GDPR, CCPA, and most ad platforms.",
      impact: "Missing privacy policy can block ad accounts and erode customer trust.",
      fix: "Add a privacy policy link to your footer and ensure it covers data collection.",
      revenueLossEstimate: 1000,
    });
  }

  // About page
  const hasAbout =
    $('a[href*="about"]').length > 0 || /about us|our story|who we are/i.test(html);

  if (!hasAbout) {
    issues.push({
      id: "trust-no-about",
      category: "Trust",
      severity: "low",
      title: "No 'About Us' link found",
      description: "Shoppers look for an About page to verify legitimacy.",
      impact: "Brand story pages increase conversion by building credibility.",
      fix: "Add an 'About Us' page link in your navigation or footer.",
      revenueLossEstimate: 500,
    });
  }

  return issues;
}
