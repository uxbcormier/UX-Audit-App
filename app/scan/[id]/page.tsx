"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Lock,
  TrendingUp,
  Zap,
  Search,
  Shield,
  Star,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import type { TeaserResults, FullResults, AuditIssue, ProprietaryMetric, SourceLabel } from "@/lib/scanner/types";
import { derivePriority } from "@/lib/scanner/priority";
import { computeDirectionalRevenueEstimate } from "@/lib/scanner/revenue";
import PaywallModal from "@/components/PaywallModal";

interface ScanData {
  id: string;
  url: string;
  status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
  overallScore: number | null;
  teaserResults: TeaserResults | null;
  fullResults: FullResults | null;
  isPaid: boolean;
  failureReason: "blocked" | "unreachable" | "empty" | "timeout" | null;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  SEO: <Search size={14} />,
  UX: <Star size={14} />,
  Trust: <Shield size={14} />,
  Performance: <Zap size={14} />,
  Conversion: <TrendingUp size={14} />,
};

const METRIC_ORDER: ProprietaryMetric[] = [
  "Product Discovery Friction",
  "PDP Purchase Readiness",
  "Checkout Friction",
  "Mobile Friction",
  "Trust Coverage",
  "Decision Complexity",
  "Performance Risk",
  "Search Experience",
];

// Status colors are reserved for meaning, never decoration — critical/high
// findings read in rust, warnings in amber, everything else stays ink/stone.
const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-rust/5 text-rust border-rust/40",
  high: "bg-rust/5 text-rust border-rust/25",
  warning: "bg-amber-800/5 text-amber-800 border-amber-800/25",
  low: "bg-stone/10 text-stone-text border-stone",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Quick win": "text-forest border-forest/40",
  "Major project": "text-ink border-stone",
  "Easy fix": "text-stone-text border-stone",
  "Low priority": "text-stone-text border-stone",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

const BUSINESS_IMPACT_COLOR: Record<string, string> = {
  high: "text-rust",
  medium: "text-amber-800",
  low: "text-stone-text",
};

const SOURCE_LABEL_INFO: Record<SourceLabel, { text: string; icon: React.ReactNode; color: string }> = {
  observed: {
    text: "Observed on this site",
    icon: <BadgeCheck size={11} />,
    color: "text-forest border-forest/40",
  },
  "research-supported": {
    text: "Supported by UX research",
    icon: <BookOpen size={11} />,
    color: "text-ink border-stone",
  },
  "internal-heuristic": {
    text: "Internal heuristic estimate",
    icon: <Lightbulb size={11} />,
    color: "text-stone-text border-stone",
  },
};

function scoreBarColor(score: number): string {
  return score >= 80 ? "bg-forest" : score >= 60 ? "bg-amber-800" : "bg-rust";
}

function scoreTextColor(score: number): string {
  return score >= 80 ? "text-forest" : score >= 60 ? "text-amber-800" : "text-rust";
}

// A short, literal interpretation of the score itself — not a claim about
// conversion, revenue, or anything the scan didn't measure directly.
function interpretScore(score: number): string {
  if (score >= 85) return "Strong — few verified issues found; the gaps that remain are worth closing.";
  if (score >= 70) return "Solid overall, with specific, fixable gaps.";
  if (score >= 50) return "Room for improvement across several areas.";
  return "Several high-impact issues were verified — worth addressing before anything else.";
}

// A discrete, non-gradient scale (0–59 / 60–79 / 80–100) with a marker at
// the actual score, so the number has a visible frame of reference without
// implying false precision via a smooth gradient.
function ScoreScale({ score }: { score: number }) {
  return (
    <div className="max-w-xs mt-5">
      <div className="relative h-1.5 w-full bg-stone/25">
        <div className="absolute inset-y-0 left-0 bg-rust/30" style={{ width: "60%" }} />
        <div className="absolute inset-y-0 bg-amber-800/30" style={{ left: "60%", width: "20%" }} />
        <div className="absolute inset-y-0 bg-forest/30" style={{ left: "80%", width: "20%" }} />
        <div
          className="absolute -top-[3px] w-0.5 h-3 bg-ink"
          style={{ left: `${Math.min(99.5, Math.max(0, score))}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-stone-text mt-1">
        <span>0</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

function ScoreHero({
  score,
  industry,
  benchmark,
  totalIssueCount,
  unableToVerifyCount,
  categorySummary,
}: {
  score: number;
  industry: string;
  benchmark: TeaserResults["benchmark"];
  totalIssueCount: number;
  unableToVerifyCount: number;
  categorySummary: TeaserResults["categorySummary"];
}) {
  const hasRealSample = benchmark.sampleSize > 0;
  const categoryEntries = Object.entries(categorySummary).filter(([, count]) => count > 0);

  return (
    <div className="flex flex-col items-start text-left">
      <span className="font-display text-7xl sm:text-8xl tracking-tight" style={{ lineHeight: 1 }}>
        <span className={scoreTextColor(score)}>{score}</span>
      </span>
      <span className="text-xs uppercase tracking-[0.2em] text-stone-text mt-2">UX Score</span>

      <ScoreScale score={score} />

      <p className="text-sm text-ink mt-4 max-w-sm leading-relaxed font-medium">{interpretScore(score)}</p>
      <p className="text-xs text-stone-text mt-1 max-w-sm leading-relaxed">
        Reflects severity-weighted, verified evidence gaps — not a measured conversion rate.
      </p>

      {categoryEntries.length > 0 && (
        <p className="text-xs text-stone-text mt-4">
          {categoryEntries.map(([cat, count], i) => (
            <span key={cat}>
              {i > 0 && " · "}
              <span className="text-ink">{count}</span> {cat}
            </span>
          ))}
        </p>
      )}

      <p className="text-xs text-stone-text mt-2">
        <span className="text-ink">{totalIssueCount}</span> verified finding{totalIssueCount !== 1 ? "s" : ""}
        {unableToVerifyCount > 0 && (
          <>
            {" "}
            · <span className="text-ink">{unableToVerifyCount}</span> check{unableToVerifyCount !== 1 ? "s" : ""}{" "}
            could not be verified
          </>
        )}
      </p>

      <p className="text-xs text-stone-text mt-3">
        {hasRealSample ? (
          <>
            {industry} average: <span className="text-ink">{benchmark.avgScore}</span>
            {benchmark.medianScore !== null && (
              <>
                {" "}
                · Median: <span className="text-ink">{benchmark.medianScore}</span>
              </>
            )}{" "}
            · Top quartile: <span className="text-ink">{benchmark.topQuartileScore}+</span>
            {benchmark.userPercentile !== null && (
              <>
                {" "}
                · You&apos;re in the <span className="text-ink">{benchmark.userPercentile}th percentile</span>
              </>
            )}{" "}
            (from {benchmark.sampleSize} real {industry} scans)
          </>
        ) : (
          <>
            Generic ecommerce baseline: <span className="text-ink">{benchmark.avgScore}</span> avg ·{" "}
            <span className="text-ink">{benchmark.topQuartileScore}+</span> top brands
          </>
        )}
      </p>
      <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-medium uppercase tracking-wide text-stone-text border border-stone px-2.5 py-0.5">
        {benchmark.label}
      </span>
    </div>
  );
}

// Horizontal-bar breakdown by proprietary metric — replaces the previous
// locked grid of bare numbers. A metric that wasn't evaluated gets an
// explanatory line instead of an empty/zero-width bar, per "don't show
// empty charts or placeholder values."
function MetricRow({ m }: { m: TeaserResults["metrics"][number] }) {
  return (
    <div className="py-3 flex items-center gap-4">
      <p className="w-36 sm:w-44 shrink-0 text-xs font-medium text-ink leading-tight">{m.metric}</p>
      {m.evaluated && m.score !== null ? (
        <>
          <div className="flex-1 h-2 bg-stone/20 min-w-0">
            <div className={`h-full ${scoreBarColor(m.score)}`} style={{ width: `${m.score}%` }} />
          </div>
          <span className={`w-8 shrink-0 text-right font-mono text-sm ${scoreTextColor(m.score)}`}>{m.score}</span>
        </>
      ) : (
        <p className="flex-1 text-xs text-stone-text italic">{m.evidenceNote}</p>
      )}
    </div>
  );
}

// Free tier shows the first 2 categories for real (so this section always
// has genuine content, never a blank/mostly-empty box) and a compact
// unlock prompt in place of the rest — rather than blurring all 8 full
// rows, which rendered as a large, nearly empty void.
function MetricsBars({ metrics, locked }: { metrics: TeaserResults["metrics"]; locked: boolean }) {
  const ordered = METRIC_ORDER.map((m) => metrics.find((r) => r.metric === m)).filter(
    (m): m is TeaserResults["metrics"][number] => Boolean(m)
  );

  if (!locked) {
    return (
      <div className="flex flex-col divide-y divide-stone border-t border-b border-stone">
        {ordered.map((m) => (
          <MetricRow key={m.metric} m={m} />
        ))}
      </div>
    );
  }

  const visible = ordered.slice(0, 2);
  const hidden = ordered.slice(2);
  const sampleNames = hidden.slice(0, 2).map((m) => m.metric).join(" and ");

  return (
    <div className="flex flex-col divide-y divide-stone border-t border-stone">
      {visible.map((m) => (
        <MetricRow key={m.metric} m={m} />
      ))}
      <div className="py-4 flex items-center justify-between gap-3 border-b border-stone">
        <span className="text-xs text-stone-text">
          +{hidden.length} more categor{hidden.length === 1 ? "y" : "ies"}
          {sampleNames ? `, including ${sampleNames}` : ""}
        </span>
        <span className="text-xs font-medium text-forest flex items-center gap-1 shrink-0">
          <Lock size={12} /> Unlock
        </span>
      </div>
    </div>
  );
}

function EvidenceBlock({ issue }: { issue: AuditIssue }) {
  const hasExamples = Boolean(issue.evidence.examples && issue.evidence.examples.length > 0);
  return (
    <div className="bg-paper border border-stone px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-text mb-1">Evidence</p>
      <p className="font-mono text-xs text-stone-text">{issue.evidence.detail}</p>
      {hasExamples && (
        <details className="mt-2">
          <summary className="text-[11px] text-forest cursor-pointer select-none">
            Show affected elements ({issue.evidence.examples!.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {issue.evidence.examples!.map((ex, i) => (
              <li key={i} className="font-mono text-[11px] text-stone-text break-all border-l-2 border-stone pl-2">
                {ex}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function IssueCard({ issue, blurred }: { issue: AuditIssue; blurred?: boolean }) {
  const priority = derivePriority(issue);
  const sourceInfo = SOURCE_LABEL_INFO[issue.sourceLabel];

  return (
    <div className={`relative border p-5 ${blurred ? "select-none" : ""} ${SEVERITY_COLOR[issue.severity]}`}>
      {blurred && (
        <div className="absolute inset-0 backdrop-blur-sm bg-paper/85 flex flex-col items-center justify-center gap-1.5">
          <Lock size={18} className="text-stone-text" />
          <span className="text-xs text-stone-text">Unlock to view</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="opacity-60">{CATEGORY_ICON[issue.category]}</span>
          <span className="text-xs font-medium uppercase tracking-wide opacity-70">{issue.metric}</span>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 border shrink-0">
          {issue.severity}
        </span>
      </div>
      <h3 className="font-display text-lg text-ink mb-1">{issue.title}</h3>
      {!blurred && (
        <p className="text-xs text-stone-text mb-3 truncate" title={issue.pageUrl}>
          {issue.pageUrl}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 border ${PRIORITY_COLOR[priority]}`}
        >
          {priority}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 border ${sourceInfo.color}`}
        >
          {sourceInfo.icon}
          {sourceInfo.text}
        </span>
      </div>
      {!blurred && (
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>{issue.observation}</p>
          <EvidenceBlock issue={issue} />
          <p className="text-stone-text">{issue.behavioralExplanation}</p>
          <p className="text-stone-text">{issue.businessImplication}</p>
          {issue.researchContext && issue.researchContext.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {issue.researchContext.map((r, i) => (
                <p key={i} className="text-xs text-stone-text border-l-2 border-stone pl-2">
                  <span className="text-ink font-medium">
                    {r.source} — {r.title}:
                  </span>{" "}
                  {r.summary}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs">
        <span className={`font-medium ${BUSINESS_IMPACT_COLOR[issue.businessImpact]}`}>
          {issue.businessImpact.charAt(0).toUpperCase() + issue.businessImpact.slice(1)} business impact
        </span>
        <span className="text-stone">·</span>
        <span className="font-mono text-stone-text">{issue.confidence}% confidence</span>
        <span className="text-stone">·</span>
        <span className="text-stone-text">{EFFORT_LABEL[issue.effort]}</span>
      </div>
      {!blurred && (
        <p className="text-sm mt-3 text-ink border-t border-stone pt-2">
          <span className="text-forest font-medium">Recommendation: </span>
          {issue.recommendation}
        </p>
      )}
    </div>
  );
}

// The single highest-priority verified finding, surfaced directly beneath
// the score — answers "what's the one thing I should look at" instead of
// making the visitor open a card to find out.
function PriorityOpportunityCard({ issue }: { issue: AuditIssue }) {
  return (
    <div className="border border-ink p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 border border-ink">
          {issue.severity}
        </span>
        <span className="text-xs text-stone-text">{EFFORT_LABEL[issue.effort]}</span>
      </div>
      <h3 className="font-display text-xl text-ink mb-1">{issue.title}</h3>
      <p className="text-xs text-stone-text mb-3 truncate" title={issue.pageUrl}>
        {issue.pageUrl}
      </p>
      <p className="text-sm text-ink mb-2">{issue.observation}</p>
      <p className="text-sm text-stone-text mb-3">{issue.businessImplication}</p>
      <p className="text-sm text-ink border-t border-stone pt-2">
        <span className="text-forest font-medium">Recommendation: </span>
        {issue.recommendation}
      </p>
    </div>
  );
}

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);

  const paymentResult = searchParams.get("payment");

  const fetchScan = useCallback(async () => {
    const res = await fetch(`/api/scan/${id}`);
    setLoading(false);
    if (!res.ok) return;
    const data: ScanData = await res.json();
    setScan(data);
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
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-text font-medium">Starting your audit…</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-stone-text">Scan not found.</p>
      </div>
    );
  }

  return <ScanResultsView scan={scan} paymentResult={paymentResult} />;
}

// Pure presentation, split out from ScanPage so it can be fed real fetched
// data OR (in local/manual QA only) hand-built mock data without touching
// the fetch/poll logic above.
export function ScanResultsView({ scan, paymentResult }: { scan: ScanData; paymentResult: string | null }) {
  const [showPaywall, setShowPaywall] = useState(false);
  const [userMonthlyRevenue, setUserMonthlyRevenue] = useState("");

  const isRunning = scan.status === "PENDING" || scan.status === "RUNNING";
  const isFailed = scan.status === "FAILED";
  const teaser = scan.teaserResults;
  const full = scan.fullResults;
  const results = full ?? teaser;

  const parsedUserRevenue = Number(userMonthlyRevenue.replace(/[^0-9.]/g, ""));
  const hasUserRevenue = parsedUserRevenue > 0;
  const directionalEstimate =
    hasUserRevenue && results
      ? computeDirectionalRevenueEstimate(results.overallScore, parsedUserRevenue)
      : null;
  const highImpactCount = results?.revenueOpportunity.highImpactCount ?? 0;
  const topIssue = results?.issues[0] ?? null;

  return (
    <main className="min-h-screen bg-paper">
      {/* Nav */}
      <nav className="border-b border-stone px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-stone-text hover:text-ink">
            <ArrowLeft size={18} />
          </Link>
          <span className="font-display text-lg tracking-tight">GRAFTER</span>
          <span className="text-sm text-stone-text ml-auto truncate max-w-xs">{scan.url}</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        {/* Running state */}
        {isRunning && (
          <div className="text-center py-16">
            <div className="w-14 h-14 border-4 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <h2 className="font-display text-2xl text-ink mb-2">Auditing your store…</h2>
            <p className="text-stone-text">
              Checking performance, SEO, UX, and trust signals. This takes about 30–60 seconds.
            </p>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="text-center py-16 max-w-lg mx-auto">
            <AlertTriangle size={40} className="text-rust mx-auto mb-4" />
            <h2 className="font-display text-2xl text-ink mb-2">Scan failed</h2>
            {scan.failureReason === "blocked" ? (
              <>
                <p className="text-stone-text mb-4">
                  {scan.url} appears to have bot protection enabled (services like Cloudflare or
                  Akamai), which is blocking our scanner.
                </p>
                <div className="text-left bg-white border border-stone p-4 mb-6 text-sm text-stone-text">
                  <p className="mb-2">
                    If this is your site, ask whoever manages your hosting or security settings to
                    allowlist our scanner by its user-agent:
                  </p>
                  <code className="block bg-paper border border-stone px-3 py-2 font-mono text-forest text-xs break-all">
                    GrafterBot/1.0
                  </code>
                </div>
              </>
            ) : scan.failureReason === "empty" ? (
              <p className="text-stone-text mb-6">
                {scan.url} came back with almost no visible content, which usually means the page
                renders entirely via JavaScript that our scanner can&apos;t execute.
              </p>
            ) : scan.failureReason === "timeout" ? (
              <p className="text-stone-text mb-6">
                This scan took longer than expected and was stopped. This is usually a temporary
                issue — try again in a moment.
              </p>
            ) : (
              <p className="text-stone-text mb-6">
                We couldn&apos;t get a reliable read of {scan.url}. The site may be blocking
                automated tools, or the URL might not be reachable — double-check it and try again.
              </p>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper font-medium hover:bg-forest transition-colors"
            >
              Try another URL
            </Link>
          </div>
        )}

        {/* Payment success banner */}
        {paymentResult === "success" && scan.isPaid && (
          <div className="flex items-center gap-3 bg-forest/5 border border-forest/40 px-5 py-4 mb-8">
            <CheckCircle size={20} className="text-forest shrink-0" />
            <div>
              <p className="font-semibold text-forest">Payment successful!</p>
              <p className="text-sm text-forest/80">
                Your full audit is unlocked. All findings and recommendations are visible below.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {scan.status === "COMPLETE" && results && (
          <>
            {/* Screenshot */}
            <section className="mb-8">
              {results.screenshotUrl && (
                <div className="border border-stone overflow-hidden bg-white">
                  <div className="flex items-center gap-2 px-3 py-2 bg-paper border-b border-stone">
                    <span className="w-2.5 h-2.5 rounded-full bg-rust/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-800/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-forest/60" />
                    <span className="text-xs text-stone-text ml-2 truncate">{scan.url}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={results.screenshotUrl} alt={`Screenshot of ${scan.url}`} className="w-full block" />
                </div>
              )}
              <p className="text-xs text-stone-text mt-2">
                Scanned: {results.pagesInspected.map((p) => p.type).join(" + ")}
              </p>
              {results.limitations.length > 0 && (
                <div className="mt-3 border border-amber-800/30 bg-amber-800/5 px-3 py-2.5">
                  <p className="text-xs font-medium text-amber-800 mb-1">Scan limitations</p>
                  <ul className="space-y-1">
                    {results.limitations.map((note, i) => (
                      <li key={i} className="text-xs text-amber-800/80 leading-relaxed">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* 1. Score */}
            <section className="mb-10">
              <ScoreHero
                score={results.overallScore}
                industry={results.industry}
                benchmark={results.benchmark}
                totalIssueCount={results.totalIssueCount}
                unableToVerifyCount={results.limitations.length}
                categorySummary={results.categorySummary}
              />
            </section>

            {/* 2. Priority Opportunities / Revenue Opportunity */}
            <section className="mb-10 border-t border-stone pt-8">
              <div className="flex items-center gap-2 text-rust mb-4">
                <TrendingUp size={16} />
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                  {directionalEstimate ? "Revenue Opportunity" : "Priority Opportunities"}
                </span>
              </div>

              {directionalEstimate && (
                <>
                  <p className="font-display text-3xl sm:text-4xl text-ink mb-1">
                    +{directionalEstimate.conversionLiftLow}–{directionalEstimate.conversionLiftHigh}%
                  </p>
                  <p className="text-sm text-stone-text mb-6">Directional conversion lift range</p>

                  <p className="font-display text-2xl sm:text-3xl text-rust mb-1">
                    ${directionalEstimate.monthlyLossLow.toLocaleString()}–$
                    {directionalEstimate.monthlyLossHigh.toLocaleString()}
                    <span className="text-base text-stone-text font-sans font-normal">/month</span>
                  </p>
                  <p className="text-sm text-stone-text mb-3">
                    Roughly ${directionalEstimate.annualLossLow.toLocaleString()}–$
                    {directionalEstimate.annualLossHigh.toLocaleString()} annually, based on the $
                    {directionalEstimate.monthlyRevenueInput.toLocaleString()}/month you entered.
                  </p>
                  <p className="text-xs text-stone-text mb-6 italic">{directionalEstimate.disclaimer}</p>
                </>
              )}

              {!directionalEstimate && (
                <p className="text-sm text-stone-text mb-5 max-w-md">
                  {highImpactCount} high-impact opportunit{highImpactCount === 1 ? "y" : "ies"} verified in this
                  scan, ranked by business impact and effort to fix. Here&apos;s the top one:
                </p>
              )}

              {topIssue && (
                <div className="mb-5">
                  <PriorityOpportunityCard issue={topIssue} />
                </div>
              )}

              <div className="bg-white border border-stone px-4 py-3 mb-4">
                <p className="text-xs text-stone-text mb-2">
                  Optional — we never store this, it only recalculates the range above in your browser.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-stone-text text-sm">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 50,000"
                    value={userMonthlyRevenue}
                    onChange={(e) => setUserMonthlyRevenue(e.target.value)}
                    className="flex-1 min-w-0 bg-paper border border-stone px-3 py-1.5 text-sm text-ink placeholder:text-stone-text focus:outline-none focus:border-ink"
                  />
                  <span className="text-stone-text text-sm whitespace-nowrap">/month revenue</span>
                </div>
              </div>

              {!scan.isPaid && (
                <button
                  onClick={() => setShowPaywall(true)}
                  className="text-sm font-medium text-forest hover:text-ink inline-flex items-center gap-1 border-b border-forest pb-0.5"
                >
                  See every opportunity <Lock size={12} />
                </button>
              )}
            </section>

            {/* 3. Business Impact Areas (proprietary metrics) */}
            <section className="mb-10 border-t border-stone pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-text mb-1">
                Business Impact Areas
              </h2>
              <p className="text-xs text-stone-text mb-4">
                Each score is derived only from evidence this scan could actually observe — areas we
                couldn&apos;t assess (e.g. checkout, without a product page) are marked as such rather
                than guessed.
              </p>
              <MetricsBars metrics={results.metrics} locked={!scan.isPaid} />
            </section>

            {/* 4. High Impact Insights */}
            <section className="mb-8 border-t border-stone pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-text mb-4">
                {scan.isPaid ? "All findings" : "High Impact Findings"}
              </h2>

              <div className="flex flex-col gap-4">
                {scan.isPaid
                  ? results.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                  : teaser?.issues.map((issue, i) => <IssueCard key={issue.id} issue={issue} blurred={i === 2} />)}
              </div>
            </section>

            {/* 5. Paywall */}
            {!scan.isPaid && (
              <section className="mb-10 bg-white border border-stone p-6 sm:p-8 text-center">
                <Lock size={26} className="mx-auto mb-4 text-forest" />
                <h2 className="font-display text-2xl sm:text-3xl text-ink mb-2">
                  See the complete evidence-led audit.
                </h2>
                <p className="text-stone-text mb-6 text-sm">
                  {results.totalIssueCount} findings detected. You&apos;ve only seen 2.
                </p>
                <ul className="text-sm text-stone-text mb-8 flex flex-col gap-2 max-w-sm mx-auto text-left">
                  {[
                    "Complete evidence for every verified finding — not just a summary",
                    "Affected elements and page screenshots where available",
                    "Recommendations prioritized by business impact and effort",
                    "Developer-ready implementation guidance for every fix",
                    "Full Business Impact Area breakdown across all 8 categories",
                    "Research references, where independently verified",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle size={15} className="text-forest shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowPaywall(true)}
                  className="px-8 py-3 bg-ink hover:bg-forest text-paper font-semibold transition-colors text-lg"
                >
                  Unlock Full Report — $129
                </button>
                <p className="text-stone-text text-xs mt-3">
                  One-time payment · Instant access · 30-day money-back guarantee
                </p>
              </section>
            )}

            {/* 6. Audit area breakdown */}
            <section className="border-t border-stone pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-text mb-4">
                Findings by Audit Area
              </h2>

              {/* Not gated: this is the same per-category count already
                  shown unlocked next to the score above — locking a
                  second view of the same numbers added nothing but an
                  empty-looking box, which is exactly what this report is
                  meant to avoid. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone">
                {Object.entries(results.categorySummary)
                  .filter(([, count]) => count > 0)
                  .map(([cat, count]) => (
                    <div key={cat} className="bg-white p-4 text-center">
                      <div className="flex justify-center mb-1 text-stone-text">{CATEGORY_ICON[cat]}</div>
                      <span className="font-display text-2xl text-ink">{count}</span>
                      <p className="text-xs text-stone-text mt-0.5">{cat}</p>
                    </div>
                  ))}
              </div>
            </section>

            {/* Full report recommendations */}
            {scan.isPaid && full?.recommendations && full.recommendations.length > 0 && (
              <section className="bg-white border border-stone p-6 mt-8">
                <h2 className="font-display text-lg text-ink mb-4">Priority recommendations</h2>
                <ul className="flex flex-col gap-2">
                  {full.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-ink">
                      <CheckCircle size={16} className="text-forest shrink-0 mt-0.5" />
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
          highImpactCount={highImpactCount}
          totalIssues={scan.teaserResults?.totalIssueCount ?? 0}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </main>
  );
}
