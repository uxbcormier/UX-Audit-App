import type { PageSpeedResult } from "../pagespeed";
import type { AuditIssue } from "../types";
import { cite } from "../research";

export function runPerformanceChecks(ps: PageSpeedResult): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (ps.mobileScore < 50) {
    issues.push({
      id: "perf-poor-mobile-score",
      category: "Performance",
      metric: "Mobile Friction",
      severity: "critical",
      title: `Poor mobile performance score (${ps.mobileScore}/100)`,
      observation: `The homepage scores ${ps.mobileScore}/100 on Google's mobile performance benchmark.`,
      evidence: {
        type: "performance-metric",
        detail: `Google PageSpeed mobile performance score: ${ps.mobileScore}/100.`,
        value: ps.mobileScore,
      },
      behavioralExplanation:
        "Mobile shoppers on the move have the least patience for a slow page, and most give up scrolling before content finishes loading.",
      businessImplication: "Slow mobile pages are strongly associated with higher abandonment.",
      businessImpact: "high",
      confidence: 95,
      effort: "high",
      recommendation: "Compress images, remove unused JavaScript, and enable server-side caching.",
      sourceLabel: "research-supported",
      researchContext: cite("googleMobileSpeed"),
    });
  } else if (ps.mobileScore < 70) {
    issues.push({
      id: "perf-average-mobile-score",
      category: "Performance",
      metric: "Mobile Friction",
      severity: "high",
      title: `Below-average mobile performance (${ps.mobileScore}/100)`,
      observation: `The homepage scores ${ps.mobileScore}/100 on mobile, below Google's recommended threshold.`,
      evidence: {
        type: "performance-metric",
        detail: `Google PageSpeed mobile performance score: ${ps.mobileScore}/100.`,
        value: ps.mobileScore,
      },
      behavioralExplanation:
        "Each extra second of load time gives an impatient mobile shopper one more reason to bounce back to search results.",
      businessImplication: "Load-time delays are associated with lower conversion rates.",
      businessImpact: "medium",
      confidence: 95,
      effort: "medium",
      recommendation: "Optimize images, defer non-critical scripts, and use a CDN.",
      sourceLabel: "research-supported",
      researchContext: cite("googleMobileSpeed"),
    });
  }

  if (ps.lcp !== null && ps.lcp > 4000) {
    issues.push({
      id: "perf-poor-lcp",
      category: "Performance",
      metric: "Performance Risk",
      severity: "critical",
      title: `Slow Largest Contentful Paint (${(ps.lcp / 1000).toFixed(1)}s)`,
      observation: `Largest Contentful Paint is ${(ps.lcp / 1000).toFixed(1)}s; Google recommends under 2.5s.`,
      evidence: {
        type: "performance-metric",
        detail: `Largest Contentful Paint measured at ${(ps.lcp / 1000).toFixed(1)}s (Google's "good" threshold is ≤2.5s).`,
        value: ps.lcp,
      },
      behavioralExplanation: "Shoppers judge a site as broken or untrustworthy before the main content even finishes painting on screen.",
      businessImplication: "Slow LCP is a Core Web Vital that can suppress Google rankings as well as conversion.",
      businessImpact: "high",
      confidence: 95,
      effort: "medium",
      recommendation: "Optimize and preload your hero image. Use next-gen image formats (WebP/AVIF).",
      sourceLabel: "research-supported",
      researchContext: cite("webVitals"),
    });
  }

  if (ps.cls !== null && ps.cls > 0.25) {
    issues.push({
      id: "perf-poor-cls",
      category: "Performance",
      metric: "Performance Risk",
      severity: "high",
      title: `High Cumulative Layout Shift (${ps.cls.toFixed(3)})`,
      observation: `Cumulative Layout Shift measures ${ps.cls.toFixed(3)}, well above Google's 0.1 threshold.`,
      evidence: {
        type: "performance-metric",
        detail: `Cumulative Layout Shift measured at ${ps.cls.toFixed(3)} (Google's "good" threshold is ≤0.1).`,
        value: ps.cls,
      },
      behavioralExplanation: "Elements jumping around mid-load cause shoppers to mis-tap buttons or links, which reads as a broken, untrustworthy experience.",
      businessImplication: "Layout instability causes accidental taps and can erode confidence in the rest of the checkout flow.",
      businessImpact: "medium",
      confidence: 95,
      effort: "low",
      recommendation: "Set explicit width/height on images and avoid dynamically injected content above the fold.",
      sourceLabel: "research-supported",
      researchContext: cite("webVitals"),
    });
  }

  if (ps.ttfb !== null && ps.ttfb > 1800) {
    issues.push({
      id: "perf-poor-ttfb",
      category: "Performance",
      metric: "Performance Risk",
      severity: "high",
      title: `Slow server response time (${Math.round(ps.ttfb)}ms TTFB)`,
      observation: `Time to First Byte is ${Math.round(ps.ttfb)}ms; Google recommends under 800ms.`,
      evidence: {
        type: "performance-metric",
        detail: `Time to First Byte measured at ${Math.round(ps.ttfb)}ms (Google's "good" threshold is ≤800ms).`,
        value: ps.ttfb,
      },
      behavioralExplanation: "Every other performance metric is downstream of this one — shoppers are waiting before the page has even started rendering.",
      businessImplication: "Slow server response time drags down every other speed metric shoppers experience.",
      businessImpact: "medium",
      confidence: 95,
      effort: "high",
      recommendation: "Upgrade your hosting plan, enable server-side caching, or switch to a CDN-backed host.",
      sourceLabel: "research-supported",
      researchContext: cite("webVitals"),
    });
  }

  if (ps.desktopScore < ps.mobileScore - 20) {
    issues.push({
      id: "perf-desktop-gap",
      category: "Performance",
      metric: "Performance Risk",
      severity: "warning",
      title: "Large gap between mobile and desktop performance",
      observation: `Desktop scores ${ps.desktopScore}/100 versus ${ps.mobileScore}/100 on mobile — a significant disparity.`,
      evidence: {
        type: "performance-metric",
        detail: `Desktop performance score ${ps.desktopScore}/100 vs mobile ${ps.mobileScore}/100.`,
      },
      behavioralExplanation: "Whichever device a shopper happens to be on, an inconsistent experience signals the site wasn't built with them in mind.",
      businessImplication: "Device-inconsistent experiences can quietly suppress conversion on whichever platform is weaker.",
      businessImpact: "low",
      confidence: 90,
      effort: "medium",
      recommendation: "Audit device-specific assets and ensure responsive images are correctly sized.",
      sourceLabel: "internal-heuristic",
    });
  }

  return issues;
}
