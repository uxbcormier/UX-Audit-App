// Default assumed monthly revenue used to translate a conversion-lift
// percentage into a dollar estimate when we don't know the site's real
// revenue — a round figure for a small-to-mid ecommerce store. Always
// surfaced in the UI as a labeled assumption, with an option for the
// visitor to recalculate against their actual revenue (see ScanPage).
export const ASSUMED_MONTHLY_REVENUE = 50_000;

// Rounds to a "nice" figure so estimates read like an estimate, not a
// fake-precise number.
function roundNice(n: number): number {
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 10000) return Math.round(n / 100) * 100;
  return Math.round(n / 1000) * 1000;
}

// The one formula behind every per-issue revenue figure: the midpoint of
// the issue's own conversion-lift range, applied to the assumed monthly
// revenue baseline above and annualized. Auditable and consistent, rather
// than a number invented per issue with no stated basis.
export function estimateAnnualRevenueLoss(lowPercent: number, highPercent: number): number {
  const midpoint = (lowPercent + highPercent) / 2;
  return roundNice(ASSUMED_MONTHLY_REVENUE * 12 * (midpoint / 100));
}
