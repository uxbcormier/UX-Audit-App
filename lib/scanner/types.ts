import type { SiteType } from "./pageClassification";

export type IssueSeverity = "critical" | "high" | "warning" | "low";
export type IssueCategory = "SEO" | "UX" | "Trust" | "Performance" | "Conversion" | "Accessibility";
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
  | "Search Experience"
  | "Accessibility";

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
  // Representative, real affected elements (image src values, heading
  // text, etc.) — never fabricated, only ever populated from data the
  // check actually collected. Capped at a few examples per finding, not a
  // full dump. Shown behind an expandable disclosure in the report.
  examples?: string[];
}

export interface ResearchCitation {
  source: string;
  title: string;
  summary: string;
  url?: string;
}

// `confidence` methodology (deliberately disclosed here rather than left
// implicit): this is a manually-assigned detection-certainty scale per
// check, NOT a statistically calibrated model trained or validated against
// labeled outcomes — no such calibration exists for this product. Each
// check's author assigns it by the kind of evidence the check actually
// has, roughly:
//   95-100  A structural/deterministic fact with no judgment call
//           involved (e.g. "page is served over http://, not https://",
//           "a <meta name=viewport> tag is absent from <head>").
//   80-94   A direct measurement from an external, authoritative source
//           (e.g. a Google PageSpeed/Lighthouse score), or pattern-matching
//           with very low false-positive/negative risk.
//   60-79   Heuristic pattern-matching (regex/selector-based) against real
//           but imperfect evidence — the dominant case across these
//           checks — where a real site's unusual markup could plausibly
//           produce a false reading despite the check's safeguards.
//   Below 60 is not used; a check this uncertain should return no finding
//   (or a `limitations` entry) rather than a low-confidence issue.
// This is a transparent, disclosed heuristic scale for READERS to weigh a
// finding by, not a claim of statistical precision. It is also distinct
// from `businessImpact` below, which is a separate, qualitative judgment
// about consequence (not a confidence level) — the two must never be
// conflated into one number.
// What an individual check builds — everything about a finding EXCEPT
// which page it was observed on, since a check only ever sees a
// ScrapedPage, not the URL it came from. index.ts stamps pageUrl on
// immediately after each check runs, producing the final AuditIssue below.
// Kept as two types rather than one optional field so it's a compile error
// to forget to stamp pageUrl on some new check's output.
export interface DraftIssue {
  id: string;
  category: IssueCategory;
  metric: ProprietaryMetric;
  severity: IssueSeverity;
  title: string;
  observation: string; // what we found, factually
  evidence: Evidence; // the underlying measurable evidence behind the observation
  behavioralExplanation: string; // why this tends to change how shoppers behave
  businessImplication: string; // what that behavior tends to cost
  businessImpact: BusinessImpact; // qualitative — not a fabricated percentage, and not a confidence level
  confidence: number; // 0-100: observation confidence only — see methodology note above
  effort: IssueEffort;
  recommendation: string; // paid-only: actionable remediation
  sourceLabel: SourceLabel;
  researchContext?: ResearchCitation[];
}

export interface AuditIssue extends DraftIssue {
  // The specific page this finding was observed on — stamped on in
  // index.ts (see DraftIssue) so every finding can say exactly where it
  // applies rather than leaving that implicit.
  pageUrl: string;
}

export interface MetricResult {
  metric: ProprietaryMetric;
  // Plain-language explanation of what this metric measures — every
  // displayed metric must carry one, so a reader never sees a bare score
  // with no idea what it represents.
  description: string;
  // False when nothing in this scan could speak to this metric (e.g. no
  // checkout flow was scanned) — surfaced as "not assessed" rather than
  // silently defaulting to a score that would misleadingly imply a clean pass.
  evaluated: boolean;
  // 0-100, null when not evaluated. Higher is always better, consistently
  // across every metric (100 minus a severity-weighted deduction) — never
  // inverted for any category.
  score: number | null;
  issueCount: number;
  evidenceNote: string;
}

// Deliberately contains no dollar figure. An earlier version of this
// computed a "directional revenue estimate" from the overall score using
// invented conversion-lift multipliers (0.12x-0.28x of the score deficit)
// with no study behind them — removed entirely rather than kept behind a
// disclaimer, since a plausible-looking number is misleading regardless of
// how it's caveated. Opportunities are presented as prioritized UX
// improvements, not monetary claims.
export interface OpportunitySummary {
  highImpactCount: number; // count of critical/high-severity issues — directly observed, not invented
}

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
  siteType: SiteType;
  benchmark: IndustryBenchmarkInfo;
  opportunitySummary: OpportunitySummary;
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
  // Every page the scan actually inspected, with how it was classified —
  // shown in the report so it never implies broader coverage than this.
  pagesInspected: { url: string; type: string }[];
  // Honest disclosures of what the scan could NOT confirm (e.g. a
  // purchase-action button whose visibility couldn't be verified). These
  // never reduce the score and are never presented as confirmed defects —
  // see purchaseAction.ts's `unable_to_verify` status.
  limitations: string[];
}

export interface FullResults extends TeaserResults {
  issues: AuditIssue[]; // all issues
  recommendations: string[];
  pageUrl: string;
  scannedAt: string;
}
