// No per-issue dollar figure exists anymore, and nothing here produces a
// dollar amount until the merchant supplies their real monthly revenue —
// see REVENUE_ESTIMATE_DISCLAIMER. The old model summed invented per-issue
// "+X% conversion" claims into a total; those percentages were never
// measured effects, and summing them would double-count overlapping
// opportunities. This file now computes one holistic, conservative
// directional range from how far the overall score sits below 100.

function roundNice(n: number): number {
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 10000) return Math.round(n / 100) * 100;
  return Math.round(n / 1000) * 1000;
}

export interface ConversionLiftRange {
  low: number;
  high: number;
}

// A single holistic range derived from the score deficit — not a sum of
// per-issue percentages. Intentionally conservative multipliers: this is a
// directional signal, not a claimed measured effect.
export function computeConversionLiftRange(overallScore: number): ConversionLiftRange {
  const deficit = Math.max(0, 100 - overallScore);
  const low = Math.max(1, Math.round(deficit * 0.12));
  const high = Math.max(low + 2, Math.round(deficit * 0.28));
  return { low, high };
}

export const REVENUE_ESTIMATE_DISCLAIMER =
  "Directional estimate — individual opportunities may overlap and actual impact requires testing.";

export interface DirectionalRevenueEstimateResult {
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

// Only produces a figure once the merchant supplies their real monthly
// revenue — there is no assumed/default baseline. Pure arithmetic, safe to
// call client-side the moment the visitor enters a number.
export function computeDirectionalRevenueEstimate(
  overallScore: number,
  monthlyRevenue: number
): DirectionalRevenueEstimateResult {
  const { low, high } = computeConversionLiftRange(overallScore);
  const monthlyLossLow = roundNice(monthlyRevenue * (low / 100));
  const monthlyLossHigh = roundNice(monthlyRevenue * (high / 100));
  return {
    hasEstimate: true,
    monthlyRevenueInput: monthlyRevenue,
    conversionLiftLow: low,
    conversionLiftHigh: high,
    monthlyLossLow,
    monthlyLossHigh,
    annualLossLow: monthlyLossLow * 12,
    annualLossHigh: monthlyLossHigh * 12,
    disclaimer: REVENUE_ESTIMATE_DISCLAIMER,
  };
}
