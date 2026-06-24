export type IssueSeverity = "critical" | "high" | "warning" | "low";
export type IssueCategory = "SEO" | "UX" | "Trust" | "Performance" | "Conversion";

// How sure we are this finding reflects reality, given what a single homepage
// fetch can actually verify (vs. a heuristic that could miss edge cases).
export type IssueConfidence = "high" | "medium";

// Rough cost to fix, used alongside severity to surface "quick win" issues first.
export type IssueEffort = "low" | "medium" | "high";

// Conversion-signal buckets used for the free-tier "signals detected" narrative.
// Distinct from IssueCategory, which drives the full (paid) category breakdown.
export type ConversionSignal =
  | "Time-to-Product"
  | "Add-to-Cart Friction"
  | "Trust Reinforcement"
  | "Mobile Complexity"
  | "Search Visibility";

export interface AuditIssue {
  id: string;
  category: IssueCategory;
  signal: ConversionSignal;
  severity: IssueSeverity;
  title: string;
  observation: string; // what we found, factually
  behavioralExplanation: string; // why this changes how shoppers behave
  businessImplication: string; // what that behavior costs the business
  estimatedImpact: string; // e.g. "+3–5% conversion"
  fix: string; // paid-only: actionable remediation
  revenueLossEstimate: number; // annual USD estimate
  confidence: IssueConfidence;
  effort: IssueEffort;
}

export interface RevenueOpportunity {
  conversionLiftLow: number; // percent, e.g. 8
  conversionLiftHigh: number; // percent, e.g. 15
  monthlyLossLow: number;
  monthlyLossHigh: number;
  annualLossLow: number;
  annualLossHigh: number;
  contributingFactors: string[];
}

export interface SignalSummary {
  signal: ConversionSignal;
  issueCount: number;
}

export interface TeaserResults {
  overallScore: number;
  revenueLoss: number;
  grade: string;
  industry: string;
  industryAvgScore: number;
  topBrandScore: number;
  // Whether industryAvgScore/topBrandScore come from real scans of this
  // industry (vs. a generic published baseline used until we have enough).
  benchmarkSampleSize: number;
  benchmarkIsFallback: boolean;
  revenueOpportunity: RevenueOpportunity;
  // Monthly revenue assumed when translating conversion-lift % into the
  // dollar figures above, for sites we have no real revenue data for.
  // Surfaced in the UI so the assumption is never hidden, alongside an
  // option to recalculate against the visitor's actual revenue.
  assumedMonthlyRevenue: number;
  signalSummary: SignalSummary[];
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
  // what was actually checked (e.g. checkout-stage claims from a homepage-only scan).
  productPageScanned: boolean;
  productPageUrl: string | null;
}

export interface FullResults extends TeaserResults {
  issues: AuditIssue[]; // all issues
  recommendations: string[];
  pageUrl: string;
  scannedAt: string;
}
