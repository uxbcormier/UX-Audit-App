import type { MobileRenderAudit } from "../scraper";
import type { DraftIssue } from "../types";
import { cite } from "../research";

// Fires only when a clear majority of visible tap targets are undersized —
// one or two small icon links shouldn't produce a page-wide finding, but a
// pattern across the page is worth flagging.
const UNDERSIZED_TAP_TARGET_RATIO = 0.3;
const SMALL_TEXT_SAMPLE_RATIO = 0.3;
const MIN_TAP_TARGET_SAMPLE = 3;
const MIN_TEXT_SAMPLE = 5;

// Runs against a real mobile-viewport render (see captureMobileRenderAudit)
// rather than guessing from the desktop capture — layout, wrapping, and
// computed font sizes can all differ completely at 375px vs. 1280px wide.
// audit is null when that capture itself failed; this always returns a
// limitation (never a confident "no mobile issues") in that case, matching
// the evidence-completeness discipline used everywhere else in the scanner.
export function runMobileChecks(audit: MobileRenderAudit | null): {
  issues: DraftIssue[];
  limitations: string[];
} {
  const issues: DraftIssue[] = [];
  const limitations: string[] = [];

  if (!audit) {
    limitations.push(
      "Could not render the homepage at a mobile viewport to check for mobile-specific layout issues — the mobile capture itself failed for this scan."
    );
    return { issues, limitations };
  }

  if (audit.hasHorizontalOverflow) {
    issues.push({
      id: "mobile-horizontal-overflow",
      category: "UX",
      metric: "Mobile Experience",
      severity: "critical",
      title: "Page content overflows the mobile viewport width",
      observation: `At a ${audit.viewportWidth}px-wide mobile viewport, ${audit.overflowOffenders.length} element${audit.overflowOffenders.length === 1 ? "" : "s"} genuinely extend past the right edge of the screen (not just hidden off-canvas content or something clipped by its own container).`,
      evidence: {
        type: "performance-metric",
        detail: `Visible, non-clipped element(s) found extending past the ${audit.viewportWidth}px viewport width in a real mobile-emulated render: ${audit.overflowOffenders.join(", ")}.`,
        value: audit.scrollWidth,
        examples: audit.overflowOffenders,
      },
      behavioralExplanation:
        "Horizontal overflow forces phone users to scroll sideways or pinch-zoom just to read content, which most people simply won't do before leaving.",
      businessImplication: "The majority of shopping traffic is mobile — a sideways-scrolling layout affects most visitors, not an edge case.",
      businessImpact: "high",
      confidence: 90,
      effort: "medium",
      recommendation: `Check ${audit.overflowOffenders[0]} (and any other elements listed in the evidence) — it's rendering wider than the viewport and isn't contained by its parent's layout.`,
      sourceLabel: "observed",
    });
  }

  if (audit.totalVisibleTapTargets >= MIN_TAP_TARGET_SAMPLE) {
    const undersizedRatio = audit.undersizedTapTargetCount / audit.totalVisibleTapTargets;
    if (undersizedRatio >= UNDERSIZED_TAP_TARGET_RATIO) {
      issues.push({
        id: "mobile-small-tap-targets",
        category: "UX",
        metric: "Mobile Experience",
        severity: "warning",
        title: "Many tap targets are smaller than recommended on mobile",
        observation: `${audit.undersizedTapTargetCount} of ${audit.totalVisibleTapTargets} visible links/buttons are smaller than 44x44px at a mobile viewport width.`,
        evidence: {
          type: "performance-metric",
          detail: `${audit.undersizedTapTargetCount}/${audit.totalVisibleTapTargets} visible tap targets measured under 44x44 CSS px in a real mobile-emulated render.`,
          value: audit.undersizedTapTargetCount,
        },
        behavioralExplanation:
          "Small tap targets are harder to hit accurately with a finger than a mouse pointer, leading to mis-taps, frustration, and abandoned attempts on exactly the elements meant to move someone forward.",
        businessImplication: "Undersized links/buttons on mobile can directly suppress clicks on calls-to-action, not just general usability.",
        businessImpact: "medium",
        confidence: 80,
        effort: "medium",
        recommendation: "Increase tap target size (padding counts) to at least 44x44px for primary links and buttons on mobile.",
        sourceLabel: "research-supported",
        researchContext: cite("wcagTargetSize"),
      });
    }
  } else {
    limitations.push(
      "Too few visible tap targets were found in the mobile render to reliably assess tap-target sizing."
    );
  }

  if (audit.totalBodyTextSamples >= MIN_TEXT_SAMPLE) {
    const smallTextRatio = audit.smallBodyTextSampleCount / audit.totalBodyTextSamples;
    if (smallTextRatio >= SMALL_TEXT_SAMPLE_RATIO) {
      issues.push({
        id: "mobile-small-text",
        category: "UX",
        metric: "Mobile Experience",
        severity: "warning",
        title: "Body text is smaller than comfortable to read on mobile",
        observation: `${audit.smallBodyTextSampleCount} of ${audit.totalBodyTextSamples} sampled text elements render under 12px at a mobile viewport width.`,
        evidence: {
          type: "performance-metric",
          detail: `${audit.smallBodyTextSampleCount}/${audit.totalBodyTextSamples} sampled visible text elements measured under 12px computed font-size in a real mobile-emulated render.`,
          value: audit.smallBodyTextSampleCount,
        },
        behavioralExplanation:
          "Text below roughly 12px is genuinely hard to read on a phone screen without zooming in, which breaks reading flow and discourages people from continuing.",
        businessImplication: "Visitors who have to fight the text size to read your page are more likely to give up before converting.",
        businessImpact: "medium",
        confidence: 60,
        effort: "low",
        recommendation: "Set a minimum body text size of around 16px on mobile (browser default), and avoid shrinking secondary text below ~12px.",
        sourceLabel: "internal-heuristic",
      });
    }
  } else {
    limitations.push(
      "Too little sampled body text was found in the mobile render to reliably assess mobile text size."
    );
  }

  return { issues, limitations };
}
