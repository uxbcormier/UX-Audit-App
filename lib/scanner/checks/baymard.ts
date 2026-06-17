import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";

// Findings in this file are tied to specific, citable Baymard Institute
// UX research guidelines, rather than our own general heuristics. Only
// guidelines that are reliably checkable from a single static homepage
// fetch (no JS execution, no crawling beyond the homepage) are included.
const AD_NETWORK_SIGNS =
  /doubleclick\.net|googlesyndication\.com|adsbygoogle|taboola\.com|outbrain\.com|criteo\.(com|net)|media\.net\/|amazon-adsystem\.com/i;

function isHomeHref(href: string | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (trimmed === "/" || trimmed === "") return true;
  if (/^https?:\/\/[^/]+\/?$/i.test(trimmed)) return true;
  return false;
}

export function runBaymardChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { html, $ } = page;

  // Guideline #240 — Be Cautious if Displaying Ads on the Homepage
  if (AD_NETWORK_SIGNS.test(html)) {
    issues.push({
      id: "baymard-homepage-ads",
      category: "UX",
      signal: "Trust Reinforcement",
      severity: "warning",
      title: "Third-party ad network detected on homepage",
      observation: "The homepage loads a script from a third-party ad network.",
      behavioralExplanation:
        "Shoppers associate on-site ads with lower-quality retailers, and on mobile, ads compete directly with your own calls-to-action for limited screen space.",
      businessImplication:
        "Baymard Institute research finds homepage ads are generally perceived negatively and can distract from or interrupt the shopping flow, particularly on mobile.",
      estimatedImpact: "+0.5–1.5% conversion",
      fix: "Remove third-party ad placements from the homepage, or move them well below the primary shopping content.",
      revenueLossEstimate: 800,
      source: "Baymard Institute — Guideline #240",
    });
  }

  // Guideline #257 — Always Link the Site Logo to the Homepage
  const logoCandidates = $("header *, nav *")
    .filter((_, el) => {
      const $el = $(el);
      const haystack = [
        $el.attr("class") ?? "",
        $el.attr("alt") ?? "",
        $el.attr("src") ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes("logo");
    })
    .get();

  if (logoCandidates.length > 0) {
    const $logo = $(logoCandidates[0]);
    const $link = $logo.closest("a");
    const logoLinksHome = $link.length > 0 && isHomeHref($link.attr("href"));

    if (!logoLinksHome) {
      issues.push({
        id: "baymard-logo-not-linked",
        category: "UX",
        signal: "Time-to-Product",
        severity: "low",
        title: "Site logo doesn't link to the homepage",
        observation: "A site logo was found, but it isn't wrapped in a link back to the homepage.",
        behavioralExplanation:
          "Shoppers instinctively click the logo to restart browsing or escape a page that isn't working for them; when it goes nowhere, that easy reset disappears.",
        businessImplication:
          "Baymard Institute research finds that without a homepage-linked logo, users find it more troublesome to restart product finding after hitting a dead end.",
        estimatedImpact: "+0.5–1% conversion",
        fix: "Wrap your site logo in a link pointing to your homepage ('/').",
        revenueLossEstimate: 500,
        source: "Baymard Institute — Guideline #257",
      });
    }
  }

  // Guideline #266 — Always Ensure Main Navigation and Drop-Down Menu
  // Category Headings Are Clickable Links
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
      id: "baymard-nonclickable-dropdown-headings",
      category: "UX",
      signal: "Time-to-Product",
      severity: "warning",
      title: "Navigation dropdown headings aren't clickable links",
      observation: `${nonClickableHeadingCount} navigation menu item${nonClickableHeadingCount > 1 ? "s" : ""} with a dropdown submenu don't have a clickable link on the heading itself.`,
      behavioralExplanation:
        "Shoppers expect to click a category heading to see all items in that category, not just the items revealed in the dropdown; when the heading does nothing, it breaks that expectation and narrows their browsing options.",
      businessImplication:
        "Baymard Institute research finds this forces users into narrower scopes than expected and makes explorative browsing more difficult.",
      estimatedImpact: "+1–2% conversion",
      fix: "Make every top-level navigation heading a real link to its category overview page, even when it also opens a dropdown.",
      revenueLossEstimate: 1200,
      source: "Baymard Institute — Guideline #266",
    });
  }

  return issues;
}
