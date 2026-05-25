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
      severity: "critical",
      title: "No clear call-to-action found",
      description: "Your homepage has no obvious purchase or action button visible above the fold.",
      impact: "Visitors don't know what to do next, causing immediate drop-off.",
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
      severity: "high",
      title: "No visible contact information",
      description: "Shoppers can't find a phone number, email, or chat widget.",
      impact: "40% of shoppers abandon if they can't find support contact info.",
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
      severity: "high",
      title: "No site search found",
      description: "Your site appears to lack a search bar.",
      impact: "Shoppers who use search convert at 2–3x the rate of those who browse.",
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
      severity: "warning",
      title: "Sparse navigation menu",
      description: `Only ${navLinks} navigation links found. Shoppers can't explore your catalog.`,
      impact: "Poor navigation increases bounce rates and reduces pages per session.",
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
      severity: "critical",
      title: "Missing mobile viewport meta tag",
      description: "No viewport meta tag found. Your site may not render correctly on mobile.",
      impact: "60%+ of ecommerce traffic is mobile. Broken mobile UX kills conversions.",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your <head>.',
      revenueLossEstimate: 5000,
    });
  }

  return issues;
}
