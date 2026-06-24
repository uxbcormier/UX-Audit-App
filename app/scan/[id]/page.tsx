"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Lock,
  TrendingDown,
  TrendingUp,
  Zap,
  Search,
  Shield,
  Star,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import type { TeaserResults, FullResults, AuditIssue, ConversionSignal } from "@/lib/scanner/types";
import { derivePriority } from "@/lib/scanner/priority";
import { ASSUMED_MONTHLY_REVENUE } from "@/lib/scanner/revenue";
import PaywallModal from "@/components/PaywallModal";

interface ScanData {
  id: string;
  url: string;
  status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
  overallScore: number | null;
  revenueLoss: number | null;
  teaserResults: TeaserResults | null;
  fullResults: FullResults | null;
  isPaid: boolean;
  failureReason: "blocked" | "unreachable" | "empty" | null;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  SEO: <Search size={14} />,
  UX: <Star size={14} />,
  Trust: <Shield size={14} />,
  Performance: <Zap size={14} />,
  Conversion: <TrendingDown size={14} />,
};

const SIGNAL_LABEL: Record<ConversionSignal, string> = {
  "Time-to-Product": "Time-to-product friction",
  "Add-to-Cart Friction": "Add-to-cart visibility risk",
  "Trust Reinforcement": "Trust signal gaps",
  "Mobile Complexity": "Mobile interaction inefficiencies",
  "Search Visibility": "Search visibility gaps",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-950/50 text-red-300 border-red-900/60",
  high: "bg-orange-950/40 text-orange-300 border-orange-900/50",
  warning: "bg-yellow-950/30 text-yellow-300 border-yellow-900/40",
  low: "bg-neutral-800/60 text-neutral-300 border-neutral-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Quick win": "bg-teal-950/40 text-teal-300 border-teal-900/50",
  "Major project": "bg-purple-950/40 text-purple-300 border-purple-900/50",
  "Easy fix": "bg-neutral-800/60 text-neutral-300 border-neutral-700",
  "Low priority": "bg-neutral-900/60 text-neutral-500 border-neutral-800",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

function ScoreHero({
  score,
  industry,
  industryAvgScore,
  topBrandScore,
  benchmarkSampleSize,
  benchmarkIsFallback,
  totalIssueCount,
}: {
  score: number;
  industry: string;
  industryAvgScore: number;
  topBrandScore: number;
  benchmarkSampleSize: number;
  benchmarkIsFallback: boolean;
  totalIssueCount: number;
}) {
  const color =
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
      <span className="text-7xl sm:text-8xl font-bold tracking-tight" style={{ lineHeight: 1 }}>
        <span className={color}>{score}</span>
      </span>
      <span className="text-xs uppercase tracking-[0.2em] text-neutral-500 mt-2">
        UX Score
      </span>
      <p className="text-sm text-neutral-400 mt-4 max-w-sm">
        This score reflects lost conversion opportunities across your experience.
      </p>
      <p className="text-xs text-neutral-500 mt-3">
        {benchmarkIsFallback ? (
          <>
            Average ecommerce score: <span className="text-neutral-300">{industryAvgScore}</span>{" "}
            · Top brands: <span className="text-neutral-300">{topBrandScore}+</span>
          </>
        ) : (
          <>
            {industry} average: <span className="text-neutral-300">{industryAvgScore}</span> (from{" "}
            {benchmarkSampleSize} real {industry} scans) · Top quartile:{" "}
            <span className="text-neutral-300">{topBrandScore}+</span>
          </>
        )}
      </p>
      <span className="inline-flex items-center gap-1.5 mt-5 text-xs font-medium text-teal-400 bg-teal-950/40 border border-teal-900/50 rounded-full px-3 py-1">
        {totalIssueCount} insight{totalIssueCount !== 1 ? "s" : ""} detected
      </span>
    </div>
  );
}

function IssueCard({ issue, blurred }: { issue: AuditIssue; blurred?: boolean }) {
  const priority = derivePriority(issue);

  return (
    <div
      className={`relative rounded-xl border p-5 transition ${blurred ? "select-none" : ""} ${SEVERITY_COLOR[issue.severity]}`}
    >
      {blurred && (
        <div className="absolute inset-0 rounded-xl backdrop-blur-sm bg-neutral-950/70 flex flex-col items-center justify-center gap-1.5">
          <Lock size={18} className="text-neutral-400" />
          <span className="text-xs text-neutral-400">Unlock to view</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="opacity-60">{CATEGORY_ICON[issue.category]}</span>
          <span className="text-xs font-medium uppercase tracking-wide opacity-70">
            {issue.category}
          </span>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border">
          {issue.severity}
        </span>
      </div>
      <h3 className="font-semibold text-neutral-100 mb-2">{issue.title}</h3>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[priority]}`}
        >
          {priority}
        </span>
        <span className="text-[10px] text-neutral-500">
          {issue.confidence === "high" ? "High" : "Medium"} confidence ·{" "}
          {EFFORT_LABEL[issue.effort]}
        </span>
      </div>
      {!blurred && (
        <div className="flex flex-col gap-1.5 text-sm text-neutral-300">
          <p>{issue.observation}</p>
          <p className="text-neutral-400">{issue.behavioralExplanation}</p>
          <p className="text-neutral-400">{issue.businessImplication}</p>
        </div>
      )}
      <p className="text-sm font-medium text-teal-400 mt-3">
        Estimated impact: {issue.estimatedImpact}
      </p>
      {!blurred && (
        <p className="text-sm mt-2 text-neutral-300 border-t border-white/10 pt-2">
          Fix: {issue.fix}
        </p>
      )}
    </div>
  );
}

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userMonthlyRevenue, setUserMonthlyRevenue] = useState("");

  const paymentResult = searchParams.get("payment");

  const fetchScan = useCallback(async () => {
    const res = await fetch(`/api/scan/${id}`);
    if (!res.ok) return;
    const data: ScanData = await res.json();
    setScan(data);
    setLoading(false);
    return data;
  }, [id]);

  useEffect(() => {
    async function poll() {
      const data = await fetchScan();
      if (data?.status === "COMPLETE" || data?.status === "FAILED") {
        clearInterval(interval);
      }
    }

    const interval = setInterval(poll, 3000);
    poll();
    return () => clearInterval(interval);
  }, [fetchScan]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 font-medium">Starting your scan…</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <p className="text-neutral-500">Scan not found.</p>
      </div>
    );
  }

  const isRunning = scan.status === "PENDING" || scan.status === "RUNNING";
  const isFailed = scan.status === "FAILED";
  const teaser = scan.teaserResults;
  const full = scan.fullResults;
  const results = full ?? teaser;

  // Every dollar figure below is derived from an assumed monthly revenue
  // baseline (see lib/scanner/revenue.ts) until the visitor enters their
  // real number, at which point we rescale linearly against that baseline.
  const assumedMonthlyRevenue = results?.assumedMonthlyRevenue ?? ASSUMED_MONTHLY_REVENUE;
  const parsedUserRevenue = Number(userMonthlyRevenue.replace(/[^0-9.]/g, ""));
  const isPersonalized = parsedUserRevenue > 0;
  const revenueMultiplier = isPersonalized ? parsedUserRevenue / assumedMonthlyRevenue : 1;
  const personalizedRevenueLoss = Math.round((scan.revenueLoss ?? 0) * revenueMultiplier);

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-neutral-500 hover:text-neutral-300">
            <ArrowLeft size={18} />
          </Link>
          <span className="font-bold text-lg text-neutral-100">
            UX<span className="text-teal-400">Audit</span>
          </span>
          <span className="text-sm text-neutral-500 ml-auto truncate max-w-xs">
            {scan.url}
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Running state */}
        {isRunning && (
          <div className="text-center py-24">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-neutral-100 mb-2">
              Scanning your store…
            </h2>
            <p className="text-neutral-500">
              Checking performance, SEO, UX, and trust signals. This takes about
              30–60 seconds.
            </p>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="text-center py-24 max-w-lg mx-auto">
            <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-100 mb-2">
              Scan failed
            </h2>
            {scan.failureReason === "blocked" ? (
              <>
                <p className="text-neutral-500 mb-4">
                  {scan.url} appears to have bot protection enabled (services
                  like Cloudflare or Akamai), which is blocking our scanner.
                </p>
                <div className="text-left bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6 text-sm text-neutral-400">
                  <p className="mb-2">
                    If this is your site, ask whoever manages your hosting or
                    security settings to allowlist our scanner by its
                    user-agent:
                  </p>
                  <code className="block bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-teal-400 text-xs break-all">
                    UXAuditBot/1.0
                  </code>
                </div>
              </>
            ) : scan.failureReason === "empty" ? (
              <p className="text-neutral-500 mb-6">
                {scan.url} came back with almost no visible content, which
                usually means the page renders entirely via JavaScript that
                our scanner can&apos;t execute.
              </p>
            ) : (
              <p className="text-neutral-500 mb-6">
                We couldn&apos;t get a reliable read of {scan.url}. The site may be
                blocking automated tools, or the URL might not be reachable —
                double-check it and try again.
              </p>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-neutral-950 rounded-xl font-medium hover:bg-teal-400 transition"
            >
              Try another URL
            </Link>
          </div>
        )}

        {/* Payment success banner */}
        {paymentResult === "success" && scan.isPaid && (
          <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl px-5 py-4 mb-10">
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-300">Payment successful!</p>
              <p className="text-sm text-emerald-400/80">
                Your full audit is unlocked. All issues and fixes are visible below.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {scan.status === "COMPLETE" && results && (
          <>
            {/* Screenshot */}
            {results.screenshotUrl && (
              <section className="mb-12">
                <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900">
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-950 border-b border-neutral-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    <span className="text-xs text-neutral-500 ml-2 truncate">{scan.url}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={results.screenshotUrl}
                    alt={`Screenshot of ${scan.url}`}
                    className="w-full block"
                  />
                </div>
              </section>
            )}

            {/* 1. Score */}
            <section className="mb-16">
              <ScoreHero
                score={results.overallScore}
                industry={results.industry}
                industryAvgScore={results.industryAvgScore}
                topBrandScore={results.topBrandScore}
                benchmarkSampleSize={results.benchmarkSampleSize}
                benchmarkIsFallback={results.benchmarkIsFallback}
                totalIssueCount={results.totalIssueCount}
              />
            </section>

            {/* 2. Revenue Opportunity */}
            <section className="mb-16 border-t border-neutral-800 pt-12">
              <div className="flex items-center gap-2 text-teal-400 mb-4">
                <TrendingUp size={16} />
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                  Revenue Opportunity Detected
                </span>
              </div>

              <p className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-1">
                +{results.revenueOpportunity.conversionLiftLow}–
                {results.revenueOpportunity.conversionLiftHigh}%
              </p>
              <p className="text-sm text-neutral-500 mb-8">Estimated conversion lift available</p>

              <p className="text-2xl sm:text-3xl font-bold text-red-400 mb-1">
                ${Math.round(results.revenueOpportunity.monthlyLossLow * revenueMultiplier).toLocaleString()}–$
                {Math.round(results.revenueOpportunity.monthlyLossHigh * revenueMultiplier).toLocaleString()}
                <span className="text-base text-neutral-500 font-normal">/month</span>
              </p>
              <p className="text-sm text-neutral-500 mb-6">
                Estimated revenue being left on the table — roughly $
                {Math.round(results.revenueOpportunity.annualLossLow * revenueMultiplier).toLocaleString()}–$
                {Math.round(results.revenueOpportunity.annualLossHigh * revenueMultiplier).toLocaleString()} annually
              </p>

              <p className="text-xs text-neutral-500 mb-4">
                Based on: {results.revenueOpportunity.contributingFactors.join(" · ")}
              </p>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 mb-4">
                <p className="text-xs text-neutral-500 mb-2">
                  {isPersonalized
                    ? "Personalized using the monthly revenue you entered below."
                    : `Assumes a $${assumedMonthlyRevenue.toLocaleString()}/month store, typical for a small ecommerce brand — enter your real number for a personalized estimate.`}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={assumedMonthlyRevenue.toLocaleString()}
                    value={userMonthlyRevenue}
                    onChange={(e) => setUserMonthlyRevenue(e.target.value)}
                    className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-neutral-500 text-sm whitespace-nowrap">/month revenue</span>
                </div>
              </div>

              {scan.isPaid ? (
                <p className="text-sm text-neutral-400 max-w-lg">
                  This range is derived from the severity-weighted issues detected below,
                  projected against typical ecommerce traffic and conversion benchmarks for
                  a store at your audit score.
                </p>
              ) : (
                <button
                  onClick={() => setShowPaywall(true)}
                  className="text-sm font-medium text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                >
                  How this is calculated <Lock size={12} />
                </button>
              )}
            </section>

            {/* 3. Conversion Signals */}
            <section className="mb-16 border-t border-neutral-800 pt-12">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-5">
                Conversion Signals Detected
              </h2>
              <div className="flex flex-col gap-3">
                {results.signalSummary.map(({ signal, issueCount }) => (
                  <div key={signal} className="flex items-center justify-between py-2 border-b border-neutral-900">
                    <span className="text-neutral-200 text-sm">{SIGNAL_LABEL[signal]}</span>
                    <span className="text-xs text-neutral-500">
                      {issueCount} signal{issueCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. High Impact Insights */}
            <section className="mb-12 border-t border-neutral-800 pt-12">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-5">
                {scan.isPaid ? "All issues found" : "High Impact Insights"}
              </h2>

              <div className="flex flex-col gap-4">
                {scan.isPaid
                  ? results.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                  : teaser?.issues.map((issue, i) => (
                      <IssueCard key={issue.id} issue={issue} blurred={i === 2} />
                    ))}
              </div>
            </section>

            {/* 5. Paywall */}
            {!scan.isPaid && (
              <section className="mb-16 bg-neutral-900 border border-neutral-800 rounded-2xl p-8 sm:p-10 text-center">
                <Lock size={28} className="mx-auto mb-4 text-teal-400" />
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 mb-2">
                  You&apos;re leaving revenue on the table.
                </h2>
                <p className="text-neutral-400 mb-6 text-sm">
                  {results.totalIssueCount} conversion insights detected. You&apos;ve only seen 2.
                </p>
                <ul className="text-sm text-neutral-400 mb-8 flex flex-col gap-1.5 max-w-sm mx-auto text-left">
                  {[
                    "Where users drop off",
                    "What's causing hesitation",
                    "What to fix first",
                    "Which opportunities matter most",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle size={15} className="text-teal-400 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowPaywall(true)}
                  className="px-8 py-3 bg-teal-500 hover:bg-teal-400 text-neutral-950 font-bold rounded-xl transition text-lg"
                >
                  Unlock Full Report — $129
                </button>
                <p className="text-neutral-500 text-xs mt-3">
                  One-time payment · Instant access · 30-day money-back guarantee
                </p>
              </section>
            )}

            {/* 6. Detailed analysis */}
            <section className="border-t border-neutral-800 pt-12">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-5">
                Full Conversion Signal Breakdown
              </h2>

              <div className={`relative grid grid-cols-2 sm:grid-cols-4 gap-4 ${!scan.isPaid ? "select-none" : ""}`}>
                {!scan.isPaid && (
                  <div className="absolute inset-0 z-10 rounded-xl backdrop-blur-sm bg-neutral-950/70 flex items-center justify-center">
                    <span className="text-sm text-neutral-400 flex items-center gap-1.5">
                      <Lock size={14} /> Full analysis locked
                    </span>
                  </div>
                )}
                {Object.entries(results.categorySummary)
                  .filter(([, count]) => count > 0)
                  .map(([cat, count]) => (
                    <div
                      key={cat}
                      className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 text-center"
                    >
                      <div className="flex justify-center mb-1 text-neutral-500">
                        {CATEGORY_ICON[cat]}
                      </div>
                      <span className="text-2xl font-bold text-neutral-100">{count}</span>
                      <p className="text-xs text-neutral-500 mt-0.5">{cat}</p>
                    </div>
                  ))}
              </div>
            </section>

            {/* Full report recommendations */}
            {scan.isPaid && full?.recommendations && full.recommendations.length > 0 && (
              <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mt-10">
                <h2 className="font-bold text-neutral-100 mb-4">
                  Priority recommendations
                </h2>
                <ul className="flex flex-col gap-2">
                  {full.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-neutral-300">
                      <CheckCircle size={16} className="text-teal-400 shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {/* Paywall Modal */}
      {showPaywall && scan && (
        <PaywallModal
          scanId={scan.id}
          revenueLoss={personalizedRevenueLoss}
          totalIssues={scan.teaserResults?.totalIssueCount ?? 0}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </main>
  );
}
