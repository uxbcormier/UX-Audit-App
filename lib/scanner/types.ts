export type IssueSeverity = "critical" | "high" | "warning" | "low";
export type IssueCategory = "SEO" | "UX" | "Trust" | "Performance" | "Conversion";

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
  industryAvgScore: number;
  topBrandScore: number;
  revenueOpportunity: RevenueOpportunity;
  signalSummary: SignalSummary[];
  issues: AuditIssue[]; // only top 3 shown (2 full + 1 locked on the client)
  totalIssueCount: number;
  categorySummary: Record<IssueCategory, number>;
  pageSpeed: {
    mobileScore: number;
    desktopScore: number;
  };
}

export interface FullResults extends TeaserResults {
  issues: AuditIssue[]; // all issues
  recommendations: string[];
  pageUrl: string;
  scannedAt: string;
}
