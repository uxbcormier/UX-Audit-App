import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";

export function runSeoChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!page.title) {
    issues.push({
      id: "seo-missing-title",
      category: "SEO",
      signal: "Search Visibility",
      severity: "critical",
      title: "Missing page title",
      observation: "The homepage has no <title> tag.",
      behavioralExplanation:
        "Search engines and browser tabs have nothing to show shoppers before they click through, so your listing looks broken or untrustworthy in search results.",
      businessImplication:
        "Lower click-through rates from organic search mean fewer new visitors ever reach your store.",
      estimatedImpact: "+2–4% organic click-through rate",
      fix: "Add a descriptive <title> tag (50–60 characters) to your homepage.",
      revenueLossEstimate: 3000,
    });
  } else if (page.title.length > 60) {
    issues.push({
      id: "seo-title-too-long",
      category: "SEO",
      signal: "Search Visibility",
      severity: "warning",
      title: "Page title too long",
      observation: `The page title is ${page.title.length} characters; Google truncates titles past 60.`,
      behavioralExplanation:
        "Shoppers scanning search results see a cut-off headline and skip past it for a competitor's cleaner listing.",
      businessImplication: "Truncated titles measurably reduce click-through rates from search.",
      estimatedImpact: "+1–2% organic click-through rate",
      fix: "Shorten your page title to under 60 characters while keeping your main keyword.",
      revenueLossEstimate: 800,
    });
  }

  if (!page.metaDescription) {
    issues.push({
      id: "seo-missing-meta-desc",
      category: "SEO",
      signal: "Search Visibility",
      severity: "high",
      title: "Missing meta description",
      observation: "No meta description tag was found on the homepage.",
      behavioralExplanation:
        "Google fills the search snippet with a fragment of body text instead, which rarely communicates your value proposition.",
      businessImplication: "Weaker snippets convert fewer searchers into clicks before they even reach your site.",
      estimatedImpact: "+1–3% organic click-through rate",
      fix: "Add a compelling meta description (150–160 characters) that includes your main value proposition.",
      revenueLossEstimate: 1500,
    });
  }

  if (page.h1s.length === 0) {
    issues.push({
      id: "seo-missing-h1",
      category: "SEO",
      signal: "Time-to-Product",
      severity: "high",
      title: "No H1 heading found",
      observation: "The homepage has no H1 tag.",
      behavioralExplanation:
        "Without a clear primary heading, both search engines and skimming visitors struggle to identify what the page is actually for.",
      businessImplication: "Weaker topical relevance signals reduce qualified organic traffic.",
      estimatedImpact: "+1–2% organic relevance",
      fix: "Add a single, descriptive H1 tag that includes your primary keyword.",
      revenueLossEstimate: 1000,
    });
  } else if (page.h1s.length > 1) {
    issues.push({
      id: "seo-multiple-h1",
      category: "SEO",
      signal: "Time-to-Product",
      severity: "warning",
      title: `Multiple H1 tags (${page.h1s.length} found)`,
      observation: `${page.h1s.length} H1 tags were found on the homepage; best practice is exactly one.`,
      behavioralExplanation:
        "Competing headlines dilute the page's focus, making it harder for both crawlers and shoppers to tell what matters most.",
      businessImplication: "Diluted topical signals reduce organic ranking strength over time.",
      estimatedImpact: "+0.5–1% organic relevance",
      fix: "Keep only one H1 tag. Use H2 and H3 for sub-sections.",
      revenueLossEstimate: 400,
    });
  }

  const imagesWithoutAlt = page.images.filter((img) => !img.hasAlt).length;
  if (imagesWithoutAlt > 0) {
    issues.push({
      id: "seo-images-missing-alt",
      category: "SEO",
      signal: "Search Visibility",
      severity: "warning",
      title: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? "s" : ""} missing alt text`,
      observation: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? "s" : ""} on the homepage have no alt text.`,
      behavioralExplanation:
        "Screen reader users and image-search crawlers get no information about what's in the photo, so product imagery contributes nothing to discovery or accessibility.",
      businessImplication: "Missed image-search traffic and added accessibility compliance risk.",
      estimatedImpact: "+0.5–1.5% organic image traffic",
      fix: "Add descriptive alt text to all product and content images.",
      revenueLossEstimate: 600,
    });
  }

  if (!page.hasSSL) {
    issues.push({
      id: "seo-no-ssl",
      category: "SEO",
      signal: "Trust Reinforcement",
      severity: "critical",
      title: "Site not using HTTPS",
      observation: "The homepage is not served over HTTPS.",
      behavioralExplanation:
        "Browsers flag the page as 'Not Secure' the moment it loads, which reads as a red flag to anyone about to hand over payment details.",
      businessImplication: "Search penalties plus an immediate trust break at the worst possible moment in the funnel.",
      estimatedImpact: "+5–9% checkout completion",
      fix: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
      revenueLossEstimate: 5000,
    });
  }

  return issues;
}
