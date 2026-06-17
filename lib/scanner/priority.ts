import type { AuditIssue } from "./types";

// Classic impact/effort framing: severity already encodes business impact,
// so priority is just that crossed with how cheap the fix is.
export function derivePriority(issue: Pick<AuditIssue, "severity" | "effort">): string {
  const highImpact = issue.severity === "critical" || issue.severity === "high";
  const lowEffort = issue.effort === "low";

  if (highImpact && lowEffort) return "Quick win";
  if (highImpact) return "Major project";
  if (lowEffort) return "Easy fix";
  return "Low priority";
}
