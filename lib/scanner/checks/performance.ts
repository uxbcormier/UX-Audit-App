import type { PageSpeedResult } from "../pagespeed";
import type { AuditIssue } from "../types";

export function runPerformanceChecks(ps: PageSpeedResult): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (ps.mobileScore < 50) {
    issues.push({
      id: "perf-poor-mobile-score",
      category: "Performance",
      severity: "critical",
      title: `Poor mobile performance score (${ps.mobileScore}/100)`,
      description: "Your site scores poorly on Google's mobile performance benchmark.",
      impact: "53% of mobile users abandon sites that take over 3 seconds to load.",
      fix: "Compress images, remove unused JavaScript, and enable server-side caching.",
      revenueLossEstimate: 5000,
    });
  } else if (ps.mobileScore < 70) {
    issues.push({
      id: "perf-average-mobile-score",
      category: "Performance",
      severity: "high",
      title: `Below-average mobile performance (${ps.mobileScore}/100)`,
      description: "Your mobile performance score needs improvement.",
      impact: "Every 1-second delay in page load reduces conversions by up to 7%.",
      fix: "Optimize images, defer non-critical scripts, and use a CDN.",
      revenueLossEstimate: 2500,
    });
  }

  if (ps.lcp !== null && ps.lcp > 4000) {
    issues.push({
      id: "perf-poor-lcp",
      category: "Performance",
      severity: "critical",
      title: `Slow Largest Contentful Paint (${(ps.lcp / 1000).toFixed(1)}s)`,
      description: "LCP measures how long the main content takes to appear. Google recommends under 2.5s.",
      impact: "Poor LCP is a Core Web Vital that directly hurts Google rankings.",
      fix: "Optimize and preload your hero image. Use next-gen image formats (WebP/AVIF).",
      revenueLossEstimate: 3500,
    });
  }

  if (ps.cls !== null && ps.cls > 0.25) {
    issues.push({
      id: "perf-poor-cls",
      category: "Performance",
      severity: "high",
      title: `High Cumulative Layout Shift (${ps.cls.toFixed(3)})`,
      description: "Elements on your page shift during load, causing accidental clicks and frustration.",
      impact: "Layout shifts cause mis-taps on mobile and erode user trust.",
      fix: "Set explicit width/height on images and avoid dynamically injected content above the fold.",
      revenueLossEstimate: 1500,
    });
  }

  if (ps.ttfb !== null && ps.ttfb > 1800) {
    issues.push({
      id: "perf-poor-ttfb",
      category: "Performance",
      severity: "high",
      title: `Slow server response time (${Math.round(ps.ttfb)}ms TTFB)`,
      description: "Your server takes too long to respond. Google recommends under 800ms.",
      impact: "Slow servers drag down every other performance metric.",
      fix: "Upgrade your hosting plan, enable server-side caching, or switch to a CDN-backed host.",
      revenueLossEstimate: 2000,
    });
  }

  if (ps.desktopScore < ps.mobileScore - 20) {
    issues.push({
      id: "perf-desktop-gap",
      category: "Performance",
      severity: "warning",
      title: "Large gap between mobile and desktop performance",
      description: `Desktop score: ${ps.desktopScore} vs mobile: ${ps.mobileScore}. Significant disparity.`,
      impact: "Inconsistent experiences across devices hurt conversions.",
      fix: "Audit device-specific assets and ensure responsive images are correctly sized.",
      revenueLossEstimate: 800,
    });
  }

  return issues;
}
