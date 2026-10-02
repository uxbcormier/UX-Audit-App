import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";

const AD_NETWORK_SIGNS =
  /doubleclick\.net|googlesyndication\.com|adsbygoogle|taboola\.com|outbrain\.com|criteo\.(com|net)|media\.net\/|amazon-adsystem\.com/i;

function isHomeHref(href: string | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (trimmed === "/" || trimmed === "") return true;
  if (/^https?:\/\/[^/]+\/?$/i.test(trimmed)) return true;
  return false;
}

export function runUxChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { $ } = page;

  // Check for CTA buttons. We match on link/button text rather than class
  // names — sites use wildly different naming conventions for CTA styling
  // (e.g. Squarespace's "cta" vs. Bootstrap's "btn"), so the keyword match
  // on visible text is the reliable signal, not the class attribute.
  const ctaKeywords = /buy|shop|add to cart|checkout|get started|order|purchase/i;
  const buttons = $("a, button").get();
  const ctaButtons = buttons.filter((el) => ctaKeywords.test($(el).text()));

  if (ctaButtons.length === 0) {
    issues.push({
      id: "ux-no-cta",
      category: "UX",
      metric: "Decision Complexity",
      severity: "critical",
      title: "No clear call-to-action found",
      observation: "No purchase or action button (e.g. 'Shop Now') was detected above the fold.",
      evidence: {
        type: "element-presence",
        detail:
          "0 links or buttons matched common call-to-action phrasing (buy, shop, checkout, get started, order, purchase) on the homepage.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers need an obvious next step within the first few seconds; without one, evaluation stalls and abandonment risk rises.",
      businessImplication: "Visitors who don't see an obvious next step can leave without ever entering the funnel.",
      businessImpact: "high",
      confidence: 65,
      effort: "low",
      recommendation: "Add a prominent CTA button ('Shop Now', 'Get Started') above the fold with high contrast.",
      sourceLabel: "research-supported",
      researchContext: cite("nngHeuristics"),
    });
  }

  // Check for homepage decision paralysis: many distinct, competing CTA labels
  // dilute the "one obvious next step" a homepage should offer.
  const ctaLabels = new Set(
    ctaButtons.map((el) => $(el).text().trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean)
  );

  if (ctaLabels.size > 6) {
    const sampleLabels = [...ctaLabels].slice(0, 3).join('", "');
    issues.push({
      id: "ux-decision-paralysis",
      category: "UX",
      metric: "Decision Complexity",
      severity: "warning",
      title: "Too many competing calls-to-action",
      observation: `${ctaLabels.size} distinct call-to-action labels (e.g. "${sampleLabels}") were found on the homepage.`,
      evidence: {
        type: "count",
        detail: `${ctaLabels.size} distinct call-to-action labels found on the homepage.`,
        value: ctaLabels.size,
      },
      behavioralExplanation:
        "When a page offers many different 'next steps' at once, deciding which one to take takes longer, and some share of shoppers decide not to act at all.",
      businessImplication:
        "A homepage without one clear primary action spreads attention thin and can slow the path to purchase.",
      businessImpact: "medium",
      confidence: 70,
      effort: "medium",
      recommendation:
        "Pick one primary call-to-action per homepage section and demote the rest to secondary (text link) styling.",
      sourceLabel: "research-supported",
      researchContext: cite("hicksLaw"),
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
      metric: "Trust Coverage",
      severity: "high",
      title: "No visible contact information",
      observation: "No phone number, email address, or chat widget was found on the homepage.",
      evidence: {
        type: "element-presence",
        detail: "No phone number, email address, or known chat-widget script detected in the page HTML.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers with pre-purchase questions have no low-friction way to reach a human, so hesitation has nowhere to resolve itself.",
      businessImplication: "Some share of shoppers abandon when they can't find a support contact.",
      businessImpact: "medium",
      confidence: 70,
      effort: "low",
      recommendation: "Add a phone number or live chat widget to the header or footer.",
      sourceLabel: "research-supported",
      researchContext: cite("trustSignalsGeneral"),
    });
  }

  // Check for search functionality
  const hasSearch =
    $('input[type="search"], input[name="q"], input[placeholder*="search" i], [class*="search"]').length > 0;

  if (!hasSearch) {
    issues.push({
      id: "ux-no-search",
      category: "UX",
      metric: "Search Experience",
      severity: "high",
      title: "No site search found",
      observation: "No search bar was detected on the homepage.",
      evidence: {
        type: "element-presence",
        detail: "No search input or search-labeled element detected in the page markup.",
        value: 0,
      },
      behavioralExplanation:
        "Shoppers who already know what they want are forced to browse navigation instead, adding steps between intent and product discovery.",
      businessImplication: "Search-intent shoppers tend to convert at a higher rate than browsers, and that lift is being left on the table.",
      businessImpact: "medium",
      confidence: 80,
      effort: "medium",
      recommendation: "Add a prominent search bar to the header on all pages.",
      sourceLabel: "research-supported",
      researchContext: cite("nngHeuristics"),
    });
  }

  // Check for navigation
  const navLinks = $("nav a, header a").length;
  if (navLinks < 3) {
    issues.push({
      id: "ux-weak-navigation",
      category: "UX",
      metric: "Product Discovery Friction",
      severity: "warning",
      title: "Sparse navigation menu",
      observation: `Only ${navLinks} navigation link${navLinks === 1 ? "" : "s"} were found in the header.`,
      evidence: {
        type: "count",
        detail: `${navLinks} link(s) found inside <nav>/<header> elements.`,
        value: navLinks,
      },
      behavioralExplanation:
        "With few paths into the catalog, shoppers run out of obvious next clicks and bounce instead of exploring further.",
      businessImplication: "Thin navigation can reduce pages per session and the odds any given visit ends in a purchase.",
      businessImpact: "low",
      confidence: 75,
      effort: "medium",
      recommendation: "Add clear category navigation with dropdowns for product collections.",
      sourceLabel: "internal-heuristic",
    });
  }

  // Check for mobile viewport meta
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (!hasViewport) {
    issues.push({
      id: "ux-no-viewport",
      category: "UX",
      metric: "Mobile Friction",
      severity: "critical",
      title: "Missing mobile viewport meta tag",
      observation: "No viewport meta tag was found in the page head.",
      evidence: {
        type: "element-presence",
        detail: 'No <meta name="viewport"> tag found in the page head.',
        value: 0,
      },
      behavioralExplanation:
        "Mobile browsers fall back to rendering a desktop-width layout, forcing shoppers to pinch and zoom through every screen.",
      businessImplication: "The majority of ecommerce traffic is mobile — a broken mobile render affects the majority of visitors.",
      businessImpact: "high",
      confidence: 100,
      effort: "low",
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your <head>.',
      sourceLabel: "observed",
    });
  }

  // Check for third-party ads on the homepage
  if (AD_NETWORK_SIGNS.test(page.html)) {
    issues.push({
      id: "ux-homepage-ads",
      category: "UX",
      metric: "Trust Coverage",
      severity: "warning",
      title: "Third-party ad network detected on homepage",
      observation: "The homepage loads a script from a third-party ad network.",
      evidence: {
        type: "structural",
        detail: "A script reference matching a known third-party ad network domain was found in the page HTML.",
      },
      behavioralExplanation:
        "Shoppers associate on-site ads with lower-quality retailers, and on mobile, ads compete directly with your own calls-to-action for limited screen space.",
      businessImplication: "On-site ads can distract from or interrupt the shopping flow, particularly on mobile.",
      businessImpact: "low",
      confidence: 90,
      effort: "low",
      recommendation: "Remove third-party ad placements from the homepage, or move them well below the primary shopping content.",
      sourceLabel: "internal-heuristic",
    });
  }

  // Check that the site logo links back to the homepage
  const logoCandidates = $("header *, nav *")
    .filter((_, el) => {
      const $el = $(el);
      const haystack = [$el.attr("class") ?? "", $el.attr("alt") ?? "", $el.attr("src") ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes("logo");
    })
    .get();

  if (logoCandidates.length > 0) {
    const $logo = $(logoCandidates[0]);
    // The logo-linking <a> can be an ancestor (logo wrapped in a link) or a
    // descendant (e.g. a "logo-wrapper" div that itself contains the link) —
    // closest() alone only finds the ancestor case, so check both directions.
    const $link = $logo.closest("a").length > 0 ? $logo.closest("a") : $logo.find("a").first();
    const logoLinksHome = $link.length > 0 && isHomeHref($link.attr("href"));

    if (!logoLinksHome) {
      issues.push({
        id: "ux-logo-not-linked",
        category: "UX",
        metric: "Product Discovery Friction",
        severity: "low",
        title: "Site logo doesn't link to the homepage",
        observation: "A site logo was found, but it isn't wrapped in a link back to the homepage.",
        evidence: {
          type: "structural",
          detail: 'The detected logo element is not wrapped in (or paired with) an <a href="/"> link.',
        },
        behavioralExplanation:
          "Shoppers instinctively click the logo to restart browsing or escape a page that isn't working for them; when it goes nowhere, that easy reset disappears.",
        businessImplication: "Without a homepage-linked logo, shoppers find it more troublesome to restart product finding after hitting a dead end.",
        businessImpact: "low",
        confidence: 65,
        effort: "low",
        recommendation: "Wrap your site logo in a link pointing to your homepage ('/').",
        sourceLabel: "internal-heuristic",
      });
    }
  }

  // Check that nav dropdown headings are themselves clickable links
  const dropdownItems = $("nav li, header li").filter(
    (_, el) => $(el).find("ul, [class*='dropdown'], [class*='submenu'], [class*='sub-menu']").length > 0
  );

  let nonClickableHeadingCount = 0;
  dropdownItems.each((_, el) => {
    const $li = $(el);
    const $directLink = $li.children("a").first();
    const href = $directLink.attr("href");
    if ($directLink.length === 0 || !href || href.trim() === "" || href.trim() === "#") {
      nonClickableHeadingCount++;
    }
  });

  if (nonClickableHeadingCount > 0) {
    issues.push({
      id: "ux-nonclickable-dropdown-headings",
      category: "UX",
      metric: "Product Discovery Friction",
      severity: "warning",
      title: "Navigation dropdown headings aren't clickable links",
      observation: `${nonClickableHeadingCount} navigation menu item${nonClickableHeadingCount > 1 ? "s" : ""} with a dropdown submenu don't have a clickable link on the heading itself.`,
      evidence: {
        type: "count",
        detail: `${nonClickableHeadingCount} navigation item(s) with a submenu have no direct href on the parent heading.`,
        value: nonClickableHeadingCount,
      },
      behavioralExplanation:
        "Shoppers expect to click a category heading to see all items in that category, not just the items revealed in the dropdown; when the heading does nothing, it breaks that expectation and narrows their browsing options.",
      businessImplication: "This forces shoppers into narrower scopes than expected and makes explorative browsing more difficult.",
      businessImpact: "low",
      confidence: 70,
      effort: "low",
      recommendation: "Make every top-level navigation heading a real link to its category overview page, even when it also opens a dropdown.",
      sourceLabel: "internal-heuristic",
    });
  }

  return issues;
}
