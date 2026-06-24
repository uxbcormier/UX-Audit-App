import type { PageSpeedResult } from "../pagespeed";
import type { AuditIssue } from "../types";
import { estimateAnnualRevenueLoss } from "../revenue";

export function runPerformanceChecks(ps: PageSpeedResult): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (ps.mobileScore < 50) {
    issues.push({
      id: "perf-poor-mobile-score",
      category: "Performance",
      signal: "Mobile Complexity",
      severity: "critical",
      title: `Poor mobile performance score (${ps.mobileScore}/100)`,
      observation: `The homepage scores ${ps.mobileScore}/100 on Google's mobile performance benchmark.`,
      behavioralExplanation:
        "Mobile shoppers on the move have the least patience for a slow page, and most give up scrolling before content finishes loading.",
      businessImplication: "Over half of mobile users abandon sites that take more than 3 seconds to load.",
      estimatedImpact: "+7–12% mobile conversion",
      fix: "Compress images, remove unused JavaScript, and enable server-side caching.",
      revenueLossEstimate: estimateAnnualRevenueLoss(7, 12),
      confidence: "high",
      effort: "high",
    });
  } else if (ps.mobileScore < 70) {
    issues.push({
      id: "perf-average-mobile-score",
      category: "Performance",
      signal: "Mobile Complexity",
      severity: "high",
      title: `Below-average mobile performance (${ps.mobileScore}/100)`,
      observation: `The homepage scores ${ps.mobileScore}/100 on mobile, below Google's recommended threshold.`,
      behavioralExplanation:
        "Each extra second of load time gives an impatient mobile shopper one more reason to bounce back to search results.",
      businessImplication: "Every 1-second delay in page load reduces conversions by up to 7%.",
      estimatedImpact: "+3–5% mobile conversion",
      fix: "Optimize images, defer non-critical scripts, and use a CDN.",
      revenueLossEstimate: estimateAnnualRevenueLoss(3, 5),
      confidence: "high",
      effort: "medium",
    });
  }

  if (ps.lcp !== null && ps.lcp > 4000) {
    issues.push({
      id: "perf-poor-lcp",
      category: "Performance",
      signal: "Mobile Complexity",
      severity: "critical",
      title: `Slow Largest Contentful Paint (${(ps.lcp / 1000).toFixed(1)}s)`,
      observation: `Largest Contentful Paint is ${(ps.lcp / 1000).toFixed(1)}s; Google recommends under 2.5s.`,
      behavioralExplanation:
        "Shoppers judge a site as broken or untrustworthy before the main content even finishes painting on screen.",
      businessImplication: "Slow LCP is a Core Web Vital that directly suppresses Google rankings as well as conversion.",
      estimatedImpact: "+3–5% conversion",
      fix: "Optimize and preload your hero image. Use next-gen image formats (WebP/AVIF).",
      revenueLossEstimate: estimateAnnualRevenueLoss(3, 5),
      confidence: "high",
      effort: "medium",
    });
  }

  if (ps.cls !== null && ps.cls > 0.25) {
    issues.push({
      id: "perf-poor-cls",
      category: "Performance",
      signal: "Mobile Complexity",
      severity: "high",
      title: `High Cumulative Layout Shift (${ps.cls.toFixed(3)})`,
      observation: `Cumulative Layout Shift measures ${ps.cls.toFixed(3)}, well above Google's 0.1 threshold.`,
      behavioralExplanation:
        "Elements jumping around mid-load cause shoppers to mis-tap buttons or links, which reads as a broken, untrustworthy experience.",
      businessImplication: "Layout instability causes accidental taps and erodes confidence in the rest of the checkout flow.",
      estimatedImpact: "+1–3% mobile conversion",
      fix: "Set explicit width/height on images and avoid dynamically injected content above the fold.",
      revenueLossEstimate: estimateAnnualRevenueLoss(1, 3),
      confidence: "high",
      effort: "low",
    });
  }

  if (ps.ttfb !== null && ps.ttfb > 1800) {
    issues.push({
      id: "perf-poor-ttfb",
      category: "Performance",
      signal: "Mobile Complexity",
      severity: "high",
      title: `Slow server response time (${Math.round(ps.ttfb)}ms TTFB)`,
      observation: `Time to First Byte is ${Math.round(ps.ttfb)}ms; Google recommends under 800ms.`,
      behavioralExplanation:
        "Every other performance metric is downstream of this one — shoppers are waiting before the page has even started rendering.",
      businessImplication: "Slow server response time drags down every other speed metric shoppers experience.",
      estimatedImpact: "+2–4% conversion",
      fix: "Upgrade your hosting plan, enable server-side caching, or switch to a CDN-backed host.",
      revenueLossEstimate: estimateAnnualRevenueLoss(2, 4),
      confidence: "high",
      effort: "high",
    });
  }

  if (ps.desktopScore < ps.mobileScore - 20) {
    issues.push({
      id: "perf-desktop-gap",
      category: "Performance",
      signal: "Mobile Complexity",
      severity: "warning",
      title: "Large gap between mobile and desktop performance",
      observation: `Desktop scores ${ps.desktopScore}/100 versus ${ps.mobileScore}/100 on mobile — a significant disparity.`,
      behavioralExplanation:
        "Whichever device a shopper happens to be on, an inconsistent experience signals the site wasn't built with them in mind.",
      businessImplication: "Device-inconsistent experiences quietly suppress conversion on whichever platform is weaker.",
      estimatedImpact: "+1–2% conversion",
      fix: "Audit device-specific assets and ensure responsive images are correctly sized.",
      revenueLossEstimate: estimateAnnualRevenueLoss(1, 2),
      confidence: "high",
      effort: "medium",
    });
  }

  return issues;
}
