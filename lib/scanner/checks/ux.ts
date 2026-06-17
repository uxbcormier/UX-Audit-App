import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";

export function runUxChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { $ } = page;

  // Check for CTA buttons
  const ctaKeywords = /buy|shop|add to cart|checkout|get started|order|purchase/i;
  const buttons = $("button, a.btn, a.button, [class*=btn], [class*=button]").get();
  const ctaButtons = buttons.filter((el) => ctaKeywords.test($(el).text()));

  if (ctaButtons.length === 0) {
    issues.push({
      id: "ux-no-cta",
      category: "UX",
      signal: "Add-to-Cart Friction",
      severity: "critical",
      title: "No clear call-to-action found",
      observation: "No purchase or action button (e.g. 'Shop Now') was detected above the fold.",
      behavioralExplanation:
        "Users require multiple interactions before discovering what action to take, which delays evaluation and increases abandonment risk.",
      businessImplication: "Visitors who don't see an obvious next step leave without ever entering the funnel.",
      estimatedImpact: "+5–9% conversion",
      fix: "Add a prominent CTA button ('Shop Now', 'Get Started') above the fold with high contrast.",
      revenueLossEstimate: 4000,
    });
  }

  // Check for contact/support info
  const hasPhone = /(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i.test(page.html);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(page.html);
  const hasChatWidget = /intercom|tawk|zendesk|crisp|livechat|tidio|freshchat/i.test(page.html);

  if (!hasPhone && !hasEmail && !hasChatWidget) {
    issues.push({
      id: "ux-no-contact",
      category: "UX",
      signal: "Trust Reinforcement",
      severity: "high",
      title: "No visible contact information",
      observation: "No phone number, email address, or chat widget was found on the homepage.",
      behavioralExplanation:
        "Shoppers with pre-purchase questions have no low-friction way to reach a human, so hesitation has nowhere to resolve itself.",
      businessImplication: "A meaningful share of shoppers abandon when they can't find a support contact.",
      estimatedImpact: "+3–5% checkout completion",
      fix: "Add a phone number or live chat widget to the header or footer.",
      revenueLossEstimate: 2500,
    });
  }

  // Check for search functionality
  const hasSearch =
    $('input[type="search"], input[name="q"], input[placeholder*="search" i], [class*="search"]').length > 0;

  if (!hasSearch) {
    issues.push({
      id: "ux-no-search",
      category: "UX",
      signal: "Time-to-Product",
      severity: "high",
      title: "No site search found",
      observation: "No search bar was detected on the homepage.",
      behavioralExplanation:
        "Shoppers who already know what they want are forced to browse navigation instead, adding steps between intent and product discovery.",
      businessImplication: "Search-intent shoppers convert at 2–3x the rate of browsers, and that lift is being left on the table.",
      estimatedImpact: "+4–7% conversion",
      fix: "Add a prominent search bar to the header on all pages.",
      revenueLossEstimate: 2000,
    });
  }

  // Check for navigation
  const navLinks = $("nav a, header a").length;
  if (navLinks < 3) {
    issues.push({
      id: "ux-weak-navigation",
      category: "UX",
      signal: "Time-to-Product",
      severity: "warning",
      title: "Sparse navigation menu",
      observation: `Only ${navLinks} navigation link${navLinks === 1 ? "" : "s"} were found in the header.`,
      behavioralExplanation:
        "With few paths into the catalog, shoppers run out of obvious next clicks and bounce instead of exploring further.",
      businessImplication: "Thin navigation reduces pages per session and the odds any given visit ends in a purchase.",
      estimatedImpact: "+1–3% conversion",
      fix: "Add clear category navigation with dropdowns for product collections.",
      revenueLossEstimate: 1200,
    });
  }

  // Check for mobile viewport meta
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (!hasViewport) {
    issues.push({
      id: "ux-no-viewport",
      category: "UX",
      signal: "Mobile Complexity",
      severity: "critical",
      title: "Missing mobile viewport meta tag",
      observation: "No viewport meta tag was found in the page head.",
      behavioralExplanation:
        "Mobile browsers fall back to rendering a desktop-width layout, forcing shoppers to pinch and zoom through every screen.",
      businessImplication: "Over 60% of ecommerce traffic is mobile — a broken mobile render kills conversion for the majority of visitors.",
      estimatedImpact: "+6–10% mobile conversion",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your <head>.',
      revenueLossEstimate: 5000,
    });
  }

  return issues;
}
