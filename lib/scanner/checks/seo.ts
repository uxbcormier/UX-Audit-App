import type { ScrapedPage } from "../scraper";
import type { AuditIssue } from "../types";

export function runSeoChecks(page: ScrapedPage): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!page.title) {
    issues.push({
      id: "seo-missing-title",
      category: "SEO",
      severity: "critical",
      title: "Missing page title",
      description: "Your page has no <title> tag. Search engines use this as the main headline in results.",
      impact: "Significantly hurts search rankings and click-through rates.",
      fix: "Add a descriptive <title> tag (50–60 characters) to your homepage.",
      revenueLossEstimate: 3000,
    });
  } else if (page.title.length > 60) {
    issues.push({
      id: "seo-title-too-long",
      category: "SEO",
      severity: "warning",
      title: "Page title too long",
      description: `Your title is ${page.title.length} characters. Google truncates titles over 60 characters in search results.`,
      impact: "Truncated titles reduce click-through rates by up to 15%.",
      fix: "Shorten your page title to under 60 characters while keeping your main keyword.",
      revenueLossEstimate: 800,
    });
  }

  if (!page.metaDescription) {
    issues.push({
      id: "seo-missing-meta-desc",
      category: "SEO",
      severity: "high",
      title: "Missing meta description",
      description: "No meta description found. Google often uses this as the snippet shown under your page title in search results.",
      impact: "Lower click-through rates from organic search.",
      fix: "Add a compelling meta description (150–160 characters) that includes your main value proposition.",
      revenueLossEstimate: 1500,
    });
  }

  if (page.h1s.length === 0) {
    issues.push({
      id: "seo-missing-h1",
      category: "SEO",
      severity: "high",
      title: "No H1 heading found",
      description: "Your page is missing an H1 tag. This is a key on-page SEO signal.",
      impact: "Weakens keyword relevance signals to search engines.",
      fix: "Add a single, descriptive H1 tag that includes your primary keyword.",
      revenueLossEstimate: 1000,
    });
  } else if (page.h1s.length > 1) {
    issues.push({
      id: "seo-multiple-h1",
      category: "SEO",
      severity: "warning",
      title: `Multiple H1 tags (${page.h1s.length} found)`,
      description: "Best practice is one H1 per page. Multiple H1s dilute keyword signals.",
      impact: "Confuses search engine crawlers about your page's primary topic.",
      fix: "Keep only one H1 tag. Use H2 and H3 for sub-sections.",
      revenueLossEstimate: 400,
    });
  }

  const imagesWithoutAlt = page.images.filter((img) => !img.hasAlt).length;
  if (imagesWithoutAlt > 0) {
    issues.push({
      id: "seo-images-missing-alt",
      category: "SEO",
      severity: "warning",
      title: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? "s" : ""} missing alt text`,
      description: "Alt text helps search engines understand image content and improves accessibility.",
      impact: "Missed keyword opportunities and accessibility compliance risk.",
      fix: "Add descriptive alt text to all product and content images.",
      revenueLossEstimate: 600,
    });
  }

  if (!page.hasSSL) {
    issues.push({
      id: "seo-no-ssl",
      category: "SEO",
      severity: "critical",
      title: "Site not using HTTPS",
      description: "Your site is not served over HTTPS. Google penalizes non-secure sites.",
      impact: "Chrome shows 'Not Secure' warning which destroys trust and conversions.",
      fix: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
      revenueLossEstimate: 5000,
    });
  }

  return issues;
}
