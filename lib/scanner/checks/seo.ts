import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";
import { cite } from "../research";

export function runSeoChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!page.title) {
    issues.push({
      id: "seo-missing-title",
      category: "SEO",
      metric: "Search Experience",
      severity: "critical",
      title: "Missing page title",
      observation: "The homepage has no <title> tag.",
      evidence: {
        type: "element-presence",
        detail: "No <title> element found in the page <head>.",
        value: 0,
      },
      behavioralExplanation:
        "Search engines and browser tabs have nothing to show shoppers before they click through, so your listing looks broken or untrustworthy in search results.",
      businessImplication:
        "Lower click-through rates from organic search mean fewer new visitors ever reach your store.",
      businessImpact: "high",
      confidence: 98,
      effort: "low",
      recommendation: "Add a descriptive <title> tag (50–60 characters) to your homepage.",
      sourceLabel: "observed",
    });
  } else if (page.title.length > 70) {
    // Google's truncation point varies with character width, not a fixed
    // count, so a couple of characters past 60 rarely actually clips — only
    // flag titles long enough that truncation is reasonably likely.
    issues.push({
      id: "seo-title-too-long",
      category: "SEO",
      metric: "Search Experience",
      severity: "low",
      title: "Page title may be getting truncated in search results",
      observation: `The page title is ${page.title.length} characters, well past the point where Google typically truncates.`,
      evidence: {
        type: "content-length",
        detail: `Page title is ${page.title.length} characters long.`,
        value: page.title.length,
      },
      behavioralExplanation:
        "Shoppers scanning search results see a cut-off headline and skip past it for a competitor's cleaner listing.",
      businessImplication: "Truncated titles can reduce click-through rates from search.",
      businessImpact: "low",
      confidence: 70,
      effort: "low",
      recommendation: "Shorten your page title to under 60 characters while keeping your main keyword.",
      sourceLabel: "internal-heuristic",
    });
  }

  if (!page.metaDescription) {
    issues.push({
      id: "seo-missing-meta-desc",
      category: "SEO",
      metric: "Search Experience",
      severity: "high",
      title: "Missing meta description",
      observation: "No meta description tag was found on the homepage.",
      evidence: {
        type: "element-presence",
        detail: 'No <meta name="description"> tag found.',
        value: 0,
      },
      behavioralExplanation:
        "Google fills the search snippet with a fragment of body text instead, which rarely communicates your value proposition.",
      businessImplication: "Weaker snippets can convert fewer searchers into clicks before they even reach your site.",
      businessImpact: "medium",
      confidence: 95,
      effort: "low",
      recommendation:
        "Add a compelling meta description (150–160 characters) that includes your main value proposition.",
      sourceLabel: "observed",
    });
  }

  if (page.h1s.length === 0) {
    issues.push({
      id: "seo-missing-h1",
      category: "SEO",
      metric: "Search Experience",
      severity: "high",
      title: "No H1 heading found",
      observation: "The homepage has no H1 tag.",
      evidence: { type: "count", detail: "0 <h1> elements found on the homepage.", value: 0 },
      behavioralExplanation:
        "Without a clear primary heading, both search engines and skimming visitors struggle to identify what the page is actually for.",
      businessImplication: "Weaker topical relevance signals can reduce qualified organic traffic.",
      businessImpact: "medium",
      confidence: 95,
      effort: "low",
      recommendation: "Add a single, descriptive H1 tag that includes your primary keyword.",
      sourceLabel: "observed",
    });
  } else if (page.h1s.length > 1) {
    issues.push({
      id: "seo-multiple-h1",
      category: "SEO",
      metric: "Search Experience",
      severity: "warning",
      title: `Multiple H1 tags (${page.h1s.length} found)`,
      observation: `${page.h1s.length} H1 tags were found on the homepage; best practice is exactly one.`,
      evidence: {
        type: "count",
        detail: `${page.h1s.length} <h1> elements found on the homepage (expected exactly 1).`,
        value: page.h1s.length,
      },
      behavioralExplanation:
        "Competing headlines dilute the page's focus, making it harder for both crawlers and shoppers to tell what matters most.",
      businessImplication: "Diluted topical signals can reduce organic ranking strength over time.",
      businessImpact: "low",
      confidence: 95,
      effort: "low",
      recommendation: "Keep only one H1 tag. Use H2 and H3 for sub-sections.",
      sourceLabel: "observed",
    });
  }

  const imagesWithoutAlt = page.images.filter((img) => !img.hasAlt).length;
  if (imagesWithoutAlt > 0) {
    issues.push({
      id: "seo-images-missing-alt",
      category: "SEO",
      metric: "Search Experience",
      severity: "warning",
      title: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? "s" : ""} missing alt text`,
      observation: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? "s" : ""} on the homepage have no alt text.`,
      evidence: {
        type: "count",
        detail: `${imagesWithoutAlt} of ${page.images.length} <img> elements have no alt attribute.`,
        value: imagesWithoutAlt,
      },
      behavioralExplanation:
        "Screen reader users and image-search crawlers get no information about what's in the photo, so product imagery contributes nothing to discovery or accessibility.",
      businessImplication: "Missed image-search traffic and added accessibility compliance risk.",
      businessImpact: "low",
      confidence: 95,
      effort: "medium",
      recommendation: "Add descriptive alt text to all product and content images.",
      sourceLabel: "observed",
    });
  }

  if (!page.hasSSL) {
    issues.push({
      id: "seo-no-ssl",
      category: "SEO",
      metric: "Trust Coverage",
      severity: "critical",
      title: "Site not using HTTPS",
      observation: "The homepage is not served over HTTPS.",
      evidence: {
        type: "structural",
        detail: "The homepage URL does not use the https:// scheme.",
      },
      behavioralExplanation:
        "Browsers flag the page as 'Not Secure' the moment it loads, which reads as a red flag to anyone about to hand over payment details.",
      businessImplication: "Search penalties plus an immediate trust break at a critical point in the funnel.",
      businessImpact: "high",
      confidence: 100,
      effort: "medium",
      recommendation: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
      sourceLabel: "research-supported",
      researchContext: cite("trustSignalsGeneral"),
    });
  }

  return issues;
}
