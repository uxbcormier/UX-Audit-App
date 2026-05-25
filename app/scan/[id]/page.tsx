"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Lock,
  TrendingDown,
  Zap,
  Search,
  Shield,
  Star,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import type { TeaserResults, FullResults, AuditIssue } from "@/lib/scanner/types";
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
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  SEO: <Search size={14} />,
  UX: <Star size={14} />,
  Trust: <Shield size={14} />,
  Performance: <Zap size={14} />,
  Conversion: <TrendingDown size={14} />,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-green-500"
      : score >= 60
        ? "text-yellow-500"
        : "text-red-500";
  const grade =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return (
    <div className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-8 border-slate-100 bg-white shadow-sm">
      <span className={`text-4xl font-bold ${color}`}>{grade}</span>
      <span className="text-sm text-slate-500">{score}/100</span>
    </div>
  );
}

function IssueCard({ issue, blurred }: { issue: AuditIssue; blurred?: boolean }) {
  return (
    <div
      className={`relative rounded-xl border p-5 transition ${blurred ? "select-none" : ""} ${SEVERITY_COLOR[issue.severity]}`}
    >
      {blurred && (
        <div className="absolute inset-0 rounded-xl backdrop-blur-sm bg-white/60 flex items-center justify-center">
          <Lock size={20} className="text-slate-500" />
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
      <h3 className="font-semibold text-slate-900 mb-1">{issue.title}</h3>
      <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
      <p className="text-sm font-medium">
        💸 Impact: {issue.impact}
      </p>
      {!blurred && (
        <p className="text-sm mt-2 text-slate-700">
          ✅ Fix: {issue.fix}
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
    let interval: ReturnType<typeof setInterval>;

    async function poll() {
      const data = await fetchScan();
      if (data?.status === "COMPLETE" || data?.status === "FAILED") {
        clearInterval(interval);
      }
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [fetchScan]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Starting your scan…</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Scan not found.</p>
      </div>
    );
  }

  const isRunning = scan.status === "PENDING" || scan.status === "RUNNING";
  const isFailed = scan.status === "FAILED";
  const teaser = scan.teaserResults;
  const full = scan.fullResults;
  const results = full ?? teaser;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft size={18} />
          </Link>
          <span className="font-bold text-lg text-slate-900">
            UX<span className="text-indigo-600">Audit</span>
          </span>
          <span className="text-sm text-slate-400 ml-auto truncate max-w-xs">
            {scan.url}
          </span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Running state */}
        {isRunning && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Scanning your store…
            </h2>
            <p className="text-slate-500">
              Checking performance, SEO, UX, and trust signals. This takes about
              30–60 seconds.
            </p>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="text-center py-20">
            <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Scan failed
            </h2>
            <p className="text-slate-500 mb-6">
              We couldn&apos;t reach {scan.url}. Make sure the URL is correct and
              publicly accessible.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium"
            >
              Try another URL
            </Link>
          </div>
        )}

        {/* Payment success banner */}
        {paymentResult === "success" && scan.isPaid && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-8">
            <CheckCircle size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Payment successful!</p>
              <p className="text-sm text-green-700">
                Your full audit is unlocked. All issues and fixes are visible below.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {scan.status === "COMPLETE" && results && (
          <>
            {/* Score header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-8 flex flex-col sm:flex-row items-center gap-8">
              <ScoreRing score={results.overallScore} />
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">
                  UX Audit Complete
                </h1>
                <p className="text-slate-500 text-sm mb-4 truncate">{scan.url}</p>
                <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-red-600">
                      ${results.revenueLoss.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500">
                      Est. annual revenue loss
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-slate-800">
                      {results.totalIssueCount}
                    </span>
                    <span className="text-xs text-slate-500">issues found</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-indigo-600">
                      {results.pageSpeed.mobileScore}
                    </span>
                    <span className="text-xs text-slate-500">mobile score</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {Object.entries(results.categorySummary)
                .filter(([, count]) => count > 0)
                .map(([cat, count]) => (
                  <div
                    key={cat}
                    className="bg-white rounded-xl border border-slate-200 p-4 text-center"
                  >
                    <div className="flex justify-center mb-1 text-slate-500">
                      {CATEGORY_ICON[cat]}
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{count}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{cat}</p>
                  </div>
                ))}
            </div>

            {/* Issues list */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                {scan.isPaid ? "All issues found" : "Top issues found"}
              </h2>

              <div className="flex flex-col gap-4">
                {results.issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}

                {/* Blurred locked cards */}
                {!scan.isPaid && results.totalIssueCount > 3 && (
                  <>
                    {[...Array(Math.min(3, results.totalIssueCount - 3))].map(
                      (_, i) => (
                        <IssueCard
                          key={`locked-${i}`}
                          issue={{
                            id: `locked-${i}`,
                            category: "UX",
                            severity: i === 0 ? "critical" : "high",
                            title: "Hidden issue — unlock full report",
                            description:
                              "This issue is hidden behind the paywall. Unlock the full report to see all issues and fixes.",
                            impact: "Unlock to see the full revenue impact.",
                            fix: "Purchase the full report to see actionable fix instructions.",
                            revenueLossEstimate: 0,
                          }}
                          blurred
                        />
                      )
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Paywall CTA */}
            {!scan.isPaid && (
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 text-white rounded-2xl p-8 text-center">
                <Lock size={32} className="mx-auto mb-3 opacity-80" />
                <h2 className="text-2xl font-bold mb-2">
                  {results.totalIssueCount - 3} more issue
                  {results.totalIssueCount - 3 !== 1 ? "s" : ""} found
                </h2>
                <p className="text-indigo-200 mb-2 text-sm">
                  You&apos;re leaving an estimated{" "}
                  <strong className="text-white">
                    ${results.revenueLoss.toLocaleString()}
                  </strong>{" "}
                  per year on the table.
                </p>
                <p className="text-indigo-200 mb-6 text-sm max-w-md mx-auto">
                  Get every issue, every fix, and every revenue estimate in your
                  full audit report.
                </p>
                <button
                  onClick={() => setShowPaywall(true)}
                  className="px-8 py-3 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition text-lg"
                >
                  Unlock Full Report — $129
                </button>
                <p className="text-indigo-300 text-xs mt-3">
                  One-time payment · Instant access · 30-day money-back guarantee
                </p>
              </div>
            )}

            {/* Full report recommendations */}
            {scan.isPaid && full?.recommendations && full.recommendations.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6">
                <h2 className="font-bold text-slate-900 mb-4">
                  Priority recommendations
                </h2>
                <ul className="flex flex-col gap-2">
                  {full.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Paywall Modal */}
      {showPaywall && scan && (
        <PaywallModal
          scanId={scan.id}
          revenueLoss={scan.revenueLoss ?? 0}
          totalIssues={scan.teaserResults?.totalIssueCount ?? 0}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </main>
  );
}
