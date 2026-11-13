import type { Element } from "domhandler";
import type { ScrapedPage } from "../scraper";
import type { DraftIssue } from "../types";
import { cite } from "../research";

// A deliberately scoped subset of WCAG 2.1: only what a scanner can verify
// without a human (DOM structure, static attributes, and — for contrast —
// real computed styles). WCAG 2.1 has 78 success criteria across A/AA/AAA;
// most (meaningful color-only cues, captions, keyboard-trap testing,
// meaningful reading order, etc.) genuinely need a person to assess. This
// module never implies a WCAG conformance level ("AA pass/fail") — each
// finding is its own narrow, evidence-backed claim, consistent with how
// every other check in this scanner is framed. See the report UI's own
// disclosure for the user-facing version of this scope note.

const FORM_CONTROL_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea';
const NON_DESCRIPTIVE_LINK_TEXT = /^(click here|read more|learn more|more|here|this link|link|more info|details)$/i;
const MIN_CONTRAST_SAMPLE = 5;
const CONTRAST_FAILURE_RATIO = 0.2;

function accessibleNameFor($: ScrapedPage["$"], el: Element): string {
  const $el = $(el);
  const ariaLabel = $el.attr("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = $el.attr("aria-labelledby");
  if (labelledBy) {
    const referenced = labelledBy
      .split(/\s+/)
      .map((id) => $(`#${CSS_ESCAPE(id)}`).text().trim())
      .filter(Boolean)
      .join(" ");
    if (referenced) return referenced;
  }

  const text = $el.text().replace(/\s+/g, " ").trim();
  if (text) return text;

  const imgAlt = $el.find("img[alt]").first().attr("alt")?.trim();
  if (imgAlt) return imgAlt;

  const title = $el.attr("title")?.trim();
  if (title) return title;

  return "";
}

// cheerio doesn't ship CSS.escape — ids containing characters special to
// CSS selectors (rare, but real) would otherwise throw inside the
// aria-labelledby lookup above rather than just failing to match.
function CSS_ESCAPE(id: string): string {
  return id.replace(/([^\w-])/g, "\\$1");
}

export function runAccessibilityChecks(page: ScrapedPage): { issues: DraftIssue[]; limitations: string[] } {
  const issues: DraftIssue[] = [];
  const limitations: string[] = [];
  const { $ } = page;

  // Language of page (WCAG 3.1.1, Level A) — a static, deterministic fact
  // from the initial HTML, so no evidence-completeness concern here.
  const htmlLang = $("html").attr("lang")?.trim();
  if (!htmlLang) {
    issues.push({
      id: "a11y-missing-lang",
      category: "Accessibility",
      metric: "Accessibility",
      severity: "high",
      title: "Page is missing a language attribute",
      observation: 'The <html> element has no lang attribute (e.g. <html lang="en">).',
      evidence: {
        type: "element-presence",
        detail: "No lang attribute (or an empty one) was found on the <html> element.",
        value: 0,
      },
      behavioralExplanation:
        "Screen readers use the declared page language to choose pronunciation and voice rules — without it, they fall back to a default that can mispronounce the entire page for a blind or low-vision visitor.",
      businessImplication: "This is a quick, low-effort fix that affects every screen-reader user on every page of the site.",
      businessImpact: "medium",
      confidence: 100,
      effort: "low",
      recommendation: 'Add a lang attribute to the <html> tag matching the page\'s primary language (e.g. <html lang="en">).',
      sourceLabel: "research-supported",
      researchContext: cite("wcagLanguageOfPage"),
    });
  }

  // Unlabeled form controls (WCAG 4.1.2, Level A) — a positive count of a
  // defect pattern found, not an absence claim, so this doesn't need
  // evidence-completeness gating: an incomplete capture could only make the
  // count an undercount, never a false positive.
  const formControls = $(FORM_CONTROL_SELECTOR).toArray();
  const unlabeledControls = formControls.filter((el) => {
    const $el = $(el);
    const id = $el.attr("id");
    const hasForLabel = id ? $(`label[for="${CSS_ESCAPE(id)}"]`).length > 0 : false;
    const isWrappedInLabel = $el.closest("label").length > 0;
    return !hasForLabel && !isWrappedInLabel && !accessibleNameFor($, el);
  });

  if (unlabeledControls.length > 0) {
    const examples = unlabeledControls.slice(0, 3).map((el) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase() ?? "input";
      const type = $el.attr("type");
      return type ? `<${tag} type="${type}">` : `<${tag}>`;
    });
    issues.push({
      id: "a11y-unlabeled-inputs",
      category: "Accessibility",
      metric: "Accessibility",
      severity: "high",
      title: "Form fields without an accessible label",
      observation: `${unlabeledControls.length} of ${formControls.length} form field${formControls.length === 1 ? "" : "s"} have no associated label, aria-label, or aria-labelledby.`,
      evidence: {
        type: "count",
        detail: `${unlabeledControls.length}/${formControls.length} form controls have no <label for>, wrapping <label>, aria-label, or aria-labelledby.`,
        value: unlabeledControls.length,
        examples,
      },
      behavioralExplanation:
        "A screen-reader user tabbing into an unlabeled field hears only its type (\"edit text\"), with no indication of what to enter — effectively a blocked form.",
      businessImplication: "An unlabeled field in a signup, contact, or checkout form can mean a screen-reader user can't complete it at all.",
      businessImpact: "high",
      confidence: 85,
      effort: "medium",
      recommendation: "Associate every form field with a <label for=\"...\"> (or aria-label) describing what it collects.",
      sourceLabel: "research-supported",
      researchContext: cite("wcagNameRoleValue"),
    });
  }

  // Links/buttons with no accessible name at all (WCAG 4.1.2, Level A).
  const interactiveEls = $('a[href], button, [role="button"]').toArray();
  const unnamedInteractive = interactiveEls.filter((el) => !accessibleNameFor($, el));

  if (unnamedInteractive.length > 0) {
    issues.push({
      id: "a11y-unnamed-interactive-element",
      category: "Accessibility",
      metric: "Accessibility",
      severity: "high",
      title: "Links or buttons with no accessible name",
      observation: `${unnamedInteractive.length} link${unnamedInteractive.length === 1 ? "" : "s"}/button${unnamedInteractive.length === 1 ? "" : "s"} have no visible text, aria-label, title, or labeled image inside them.`,
      evidence: {
        type: "count",
        detail: `${unnamedInteractive.length} <a>/<button>/[role=button] element(s) found with no determinable accessible name.`,
        value: unnamedInteractive.length,
      },
      behavioralExplanation:
        "A screen reader announces these as just \"link\" or \"button\" with nothing else — the user has no way to know what it does without guessing.",
      businessImplication: "Icon-only buttons (close, menu, cart) are common culprits, and often sit on critical paths like navigation or checkout.",
      businessImpact: "high",
      confidence: 85,
      effort: "medium",
      recommendation: "Give every link/button either visible text or an aria-label describing what it does (e.g. aria-label=\"Close menu\").",
      sourceLabel: "research-supported",
      researchContext: cite("wcagNameRoleValue"),
    });
  }

  // Non-descriptive link text (WCAG 2.4.4, Level A) — links whose
  // accessible name is exactly a vague phrase with no other context.
  const nonDescriptiveLinks = $("a[href]")
    .toArray()
    .filter((el) => {
      const name = accessibleNameFor($, el);
      return name !== "" && NON_DESCRIPTIVE_LINK_TEXT.test(name);
    });

  if (nonDescriptiveLinks.length > 0) {
    issues.push({
      id: "a11y-non-descriptive-links",
      category: "Accessibility",
      metric: "Accessibility",
      severity: "warning",
      title: "Links with non-descriptive text",
      observation: `${nonDescriptiveLinks.length} link${nonDescriptiveLinks.length === 1 ? "" : "s"} use vague text like "click here" or "read more" with no other accessible context.`,
      evidence: {
        type: "count",
        detail: `${nonDescriptiveLinks.length} <a> element(s) found whose entire accessible name matches a non-descriptive phrase.`,
        value: nonDescriptiveLinks.length,
      },
      behavioralExplanation:
        "Screen-reader users often jump between pages via a links-only list — out of that context, \"click here\" or \"read more\" says nothing about where it goes.",
      businessImplication: "Harder navigation for screen-reader users translates to a worse experience on exactly the links meant to move someone forward.",
      businessImpact: "medium",
      confidence: 80,
      effort: "medium",
      recommendation: "Rewrite link text to describe its destination on its own (e.g. \"Read our return policy\" instead of \"Read more\").",
      sourceLabel: "research-supported",
      researchContext: cite("wcagLinkPurpose"),
    });
  }

  // Heading-level skips (e.g. H2 straight to H4) — a widely-recommended
  // technique for WCAG 1.3.1, not itself a distinct success criterion, so
  // this stays an internal heuristic rather than citing a specific SC.
  const headingLevels = $("h1, h2, h3, h4, h5, h6")
    .toArray()
    .map((el) => parseInt(el.tagName.slice(1), 10));

  let skipCount = 0;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) skipCount++;
  }

  if (skipCount > 0) {
    issues.push({
      id: "a11y-heading-hierarchy-skip",
      category: "Accessibility",
      metric: "Accessibility",
      severity: "low",
      title: "Heading levels skip a level",
      observation: `${skipCount} place${skipCount === 1 ? "" : "s"} in the page jump more than one heading level (e.g. an H2 followed directly by an H4).`,
      evidence: {
        type: "count",
        detail: `${skipCount} transition(s) between consecutive headings skip at least one level.`,
        value: skipCount,
      },
      behavioralExplanation:
        "Screen-reader users often navigate by heading level to build a mental outline of the page; a skipped level reads as a gap in that structure.",
      businessImplication: "A low-severity structural issue — worth fixing, but unlikely on its own to block someone from completing a task.",
      businessImpact: "low",
      confidence: 60,
      effort: "low",
      recommendation: "Use heading levels in sequential order (H1 → H2 → H3) without skipping any.",
      sourceLabel: "internal-heuristic",
    });
  }

  // Duplicate ids — WCAG 2.0's SC 4.1.1 (Parsing) covered this but was
  // removed as a distinct criterion in WCAG 2.2 (assistive tech now relies
  // on the browser's own parsing), so this is framed as a practical
  // accessibility risk rather than citing a specific success criterion:
  // duplicate ids break label[for] association and aria-describedby/
  // aria-labelledby references, which do still matter under 4.1.2.
  const idCounts = new Map<string, number>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  });
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);

  if (duplicateIds.length > 0) {
    issues.push({
      id: "a11y-duplicate-ids",
      category: "Accessibility",
      metric: "Accessibility",
      severity: "warning",
      title: "Duplicate id attributes found",
      observation: `${duplicateIds.length} id value${duplicateIds.length === 1 ? " is" : "s are"} used on more than one element on the page.`,
      evidence: {
        type: "count",
        detail: `${duplicateIds.length} duplicate id value(s) found across the page's elements.`,
        value: duplicateIds.length,
        examples: duplicateIds.slice(0, 3).map(([id, count]) => `#${id} (used ${count} times)`),
      },
      behavioralExplanation:
        "A <label for=\"x\"> or aria-labelledby=\"x\" reference is only reliable when \"x\" uniquely identifies one element — with duplicates, assistive technology can resolve it to the wrong one.",
      businessImplication: "Can silently break label associations on forms, which has the same practical effect as not labeling the field at all.",
      businessImpact: "medium",
      confidence: 90,
      effort: "low",
      recommendation: "Make every id attribute unique across the page.",
      sourceLabel: "internal-heuristic",
    });
  }

  // Color contrast (WCAG 1.4.3, Level AA) — needs the real computed-style
  // sample captured during the live render (see ContrastAudit in
  // scraper.ts). A null audit means that capture failed; withhold any
  // contrast claim rather than imply the page passed.
  if (!page.contrastAudit) {
    limitations.push(
      "Could not sample text/background colors to check contrast ratios — the live render capture was incomplete for this scan."
    );
  } else if (page.contrastAudit.totalSampled < MIN_CONTRAST_SAMPLE) {
    limitations.push(
      "Too little visible text was found on the homepage to reliably sample color contrast."
    );
  } else {
    const { totalSampled, failureCount, failureExamples } = page.contrastAudit;
    if (failureCount / totalSampled >= CONTRAST_FAILURE_RATIO) {
      issues.push({
        id: "a11y-low-contrast-text",
        category: "Accessibility",
        metric: "Accessibility",
        severity: "high",
        title: "Low-contrast text found on the homepage",
        observation: `${failureCount} of ${totalSampled} sampled text elements fall below WCAG's minimum contrast ratio against their background (4.5:1, or 3:1 for large text).`,
        evidence: {
          type: "performance-metric",
          detail: `${failureCount}/${totalSampled} sampled visible text elements measured under the required contrast ratio in a real rendered page.`,
          value: failureCount,
          examples: failureExamples,
        },
        behavioralExplanation:
          "Low-contrast text is hard to read for people with low vision, color-vision deficiencies, or just a phone screen in bright sunlight — a meaningfully larger group than screen-reader users alone.",
        businessImplication: "Visitors who struggle to read key text (prices, CTAs, policies) are more likely to disengage before converting.",
        businessImpact: "medium",
        confidence: 75,
        effort: "medium",
        recommendation: "Darken text or lighten its background (or the reverse) until the contrast ratio reaches at least 4.5:1 for normal text, 3:1 for large text.",
        sourceLabel: "research-supported",
        researchContext: cite("wcagContrastMinimum"),
      });
    }
  }

  return { issues, limitations };
}
