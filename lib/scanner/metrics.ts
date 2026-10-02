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
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "PDP Purchase Readiness",
    available: ({ productPageScanned }) => productPageScanned,
    notAssessedNote: "Not assessed — no product page was found to scan alongside the homepage",
  },
  {
    metric: "Checkout Friction",
    available: () => false,
    notAssessedNote: "Not assessed — this scan covers the homepage and a product page, not the checkout flow",
  },
  {
    metric: "Mobile Friction",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "Trust Coverage",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "Decision Complexity",
    available: () => true,
    notAssessedNote: "Not assessed",
  },
  {
    metric: "Performance Risk",
    available: ({ pageSpeedAvailable }) => pageSpeedAvailable,
    notAssessedNote: "Not assessed — the PageSpeed check didn't return in time for this scan",
  },
  {
    metric: "Search Experience",
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
  return METRIC_DEFINITIONS.map(({ metric, available, notAssessedNote }) => {
    const evaluated = available(ctx);
    const metricIssues = issues.filter((i) => i.metric === metric);

    if (!evaluated) {
      return { metric, evaluated: false, score: null, issueCount: 0, evidenceNote: notAssessedNote };
    }

    const deduction = metricIssues.reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - deduction));
    const evidenceNote =
      metricIssues.length === 0
        ? "No issues found in this area"
        : `Based on ${metricIssues.length} finding${metricIssues.length > 1 ? "s" : ""}`;

    return { metric, evaluated: true, score, issueCount: metricIssues.length, evidenceNote };
  });
}
