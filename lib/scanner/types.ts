export type IssueSeverity = "critical" | "high" | "warning" | "low";
export type IssueCategory = "SEO" | "UX" | "Trust" | "Performance" | "Conversion";

export interface AuditIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  impact: string;
  fix: string;
  revenueLossEstimate: number; // annual USD estimate
}

export interface TeaserResults {
  overallScore: number;
  revenueLoss: number;
  grade: string;
  issues: AuditIssue[]; // only 3 shown
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
