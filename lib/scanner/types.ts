export type IssueSeverity = "critical" | "high" | "warning" | "low";
export type IssueCategory = "SEO" | "UX" | "Trust" | "Performance" | "Conversion";
export type IssueEffort = "low" | "medium" | "high";

// Distinct from severity: severity is "how broken is this," businessImpact
// is "how much does this plausibly matter for conversion." Both are
// qualitative judgment calls, not fabricated percentages.
export type BusinessImpact = "low" | "medium" | "high";

// How a finding should be read: something directly observed on the
// scanned page(s), a general UX principle backed by published research
// (never proof of this specific site's conversion loss), or an internal
// heuristic judgment call with no external research behind it.
export type SourceLabel = "observed" | "research-supported" | "internal-heuristic";

// Proprietary, evidence-based scoring buckets. Each groups related
// observable evidence into one business-relevant capability. Replaces the
// old approach of summing invented per-issue "+X% conversion" claims into
// a single number — see lib/scanner/metrics.ts for how these are scored.
export type ProprietaryMetric =
  | "Product Discovery Friction"
  | "PDP Purchase Readiness"
  | "Checkout Friction"
  | "Mobile Friction"
  | "Trust Coverage"
  | "Decision Complexity"
  | "Performance Risk"
  | "Search Experience";

export type EvidenceType =
  | "element-presence"
  | "count"
  | "content-length"
  | "performance-metric"
  | "structural";

// The measurable thing the scanner actually checked, kept separate from
// the narrative `observation` so every finding exposes exactly what was
// detected (a count, a missing element, a measured metric) — not just an
// assertion the visitor has to take on faith.
export interface Evidence {
  type: EvidenceType;
  detail: string;
  value?: string | number;
}

export interface ResearchCitation {
  source: string;
  title: string;
  summary: string;
  url?: string;
}

export interface AuditIssue {
  id: string;
  category: IssueCategory;
  metric: ProprietaryMetric;
  severity: IssueSeverity;
  title: string;
  observation: string; // what we found, factually
  evidence: Evidence; // the underlying measurable evidence behind the observation
  behavioralExplanation: string; // why this tends to change how shoppers behave
  businessImplication: string; // what that behavior tends to cost
  businessImpact: BusinessImpact; // qualitative — not a fabricated percentage
  confidence: number; // 0-100: how directly the scanner could verify this finding
  effort: IssueEffort;
  recommendation: string; // paid-only: actionable remediation
  sourceLabel: SourceLabel;
  researchContext?: ResearchCitation[];
}

export interface MetricResult {
  metric: ProprietaryMetric;
  // False when nothing in this scan could speak to this metric (e.g. no
  // checkout flow was scanned) — surfaced as "not assessed" rather than
  // silently defaulting to a score that would misleadingly imply a clean pass.
  evaluated: boolean;
  score: number | null; // 0-100, null when not evaluated
  issueCount: number;
  evidenceNote: string;
}

// Shown before the visitor supplies their real revenue — deliberately
// contains no dollar figure or fabricated precision.
export interface RevenueOpportunityPlaceholder {
  hasEstimate: false;
  highImpactCount: number; // count of critical/high-severity issues — directly observed, not invented
}

export interface DirectionalRevenueEstimate {
  hasEstimate: true;
  monthlyRevenueInput: number;
  conversionLiftLow: number;
  conversionLiftHigh: number;
  monthlyLossLow: number;
  monthlyLossHigh: number;
  annualLossLow: number;
  annualLossHigh: number;
  disclaimer: string;
}

export type RevenueOpportunity = RevenueOpportunityPlaceholder | DirectionalRevenueEstimate;

export type BenchmarkTier = "fallback" | "early" | "growing" | "established";

export interface IndustryBenchmarkInfo {
  avgScore: number;
  topQuartileScore: number;
  medianScore: number | null;
  sampleSize: number;
  tier: BenchmarkTier;
  label: string; // human-readable, e.g. "Early benchmark estimate"
  userPercentile: number | null;
}

export interface TeaserResults {
  overallScore: number;
  grade: string;
  industry: string;
  benchmark: IndustryBenchmarkInfo;
  revenueOpportunity: RevenueOpportunityPlaceholder;
  metrics: MetricResult[];
  issues: AuditIssue[]; // only top 3 shown (2 full + 1 locked on the client)
  totalIssueCount: number;
  categorySummary: Record<IssueCategory, number>;
  pageSpeed: {
    mobileScore: number;
    desktopScore: number;
  };
  // Above-the-fold screenshot taken during the scan, shown free in the
  // teaser for credibility. Null if the capture failed.
  screenshotUrl: string | null;
  // Whether a product page was found and successfully scanned alongside the
  // homepage. Surfaced so the report never implies more page coverage than
  // what was actually checked.
  productPageScanned: boolean;
  productPageUrl: string | null;
}

export interface FullResults extends TeaserResults {
  issues: AuditIssue[]; // all issues
  recommendations: string[];
  pageUrl: string;
  scannedAt: string;
}
