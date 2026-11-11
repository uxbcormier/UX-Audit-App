import type { AuditIssue, IssueSeverity, MetricResult, ProprietaryMetric } from "./types";

// The single severity-weight table behind every score in the app — the
// overall UX score and every per-metric score below both use this, so a
// "critical" finding always costs the same regardless of which rollup is
// reading it.
export const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 25,
  high: 15,
  warning: 8,
  low: 3,
};

interface MetricContext {
  productPageScanned: boolean;
  pageSpeedAvailable: boolean;
}

interface MetricDefinition {
  metric: ProprietaryMetric;
  // Plain-language explanation of what this metric measures — shown
  // alongside every score so a number never appears unexplained.
  description: string;
  // Whether this scan was even capable of speaking to this metric, given
  // what was actually scanned. A metric nothing could evaluate (e.g.
  // Checkout Friction — no checkout flow is scanned) is reported as "not
  // assessed" rather than defaulting to a score that implies a clean pass.
  available: (ctx: MetricContext) => boolean;
  notAssessedNote: string;
}

const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    metric: "Product Discovery Friction",
    description: "How easily shoppers can find products through navigation and site search.",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "PDP Purchase Readiness",
    description: "Whether a product page has what's needed to let a shopper actually buy.",
    available: ({ productPageScanned }) => productPageScanned,
    notAssessedNote: "Not assessed — no product page was found to scan alongside the homepage",
  },
  {
    metric: "Checkout Friction",
    description: "Friction in the cart and checkout flow.",
    available: () => false,
    notAssessedNote: "Not assessed — this scan covers the homepage and a product page, not the checkout flow",
  },
  {
    metric: "Mobile Friction",
    description: "Mobile page load speed and rendering quality.",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "Trust Coverage",
    description: "Signals shoppers use to judge legitimacy — reviews, policies, security language.",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "Decision Complexity",
    description: "Whether the page offers one clear next step, or too many competing ones.",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "Performance Risk",
    description: "Core Web Vitals and server response time.",
    available: ({ pageSpeedAvailable }) => pageSpeedAvailable,
    notAssessedNote: "Not assessed — the PageSpeed check didn't return in time for this scan",
  },
  {
    metric: "Search Experience",
    description: "SEO fundamentals and on-site search.",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
];

// Scores each of the 8 proprietary metrics from the evidence already
// collected, rather than producing a single additive "conversion lift %."
// A metric's score is a straightforward severity-weighted deduction among
// only the issues that feed it — transparent and re-derivable from the
// issue list itself, not a separate invented number.
export function computeMetricResults(issues: AuditIssue[], ctx: MetricContext): MetricResult[] {
  return METRIC_DEFINITIONS.map(({ metric, description, available, notAssessedNote }) => {
    const evaluated = available(ctx);
    const metricIssues = issues.filter((i) => i.metric === metric);

    if (!evaluated) {
      return { metric, description, evaluated: false, score: null, issueCount: 0, evidenceNote: notAssessedNote };
    }

    const deduction = metricIssues.reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - deduction));
    const evidenceNote =
      metricIssues.length === 0
        ? "No issues found in this area"
        : `Based on ${metricIssues.length} finding${metricIssues.length > 1 ? "s" : ""}`;

    return { metric, description, evaluated: true, score, issueCount: metricIssues.length, evidenceNote };
  });
}
