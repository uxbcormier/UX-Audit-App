import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage, InteractiveElementEvidence } from "../scraper";
import { runUxChecks } from "../checks/ux";
import { categorySummary } from "../index";
import type { AuditIssue } from "../types";

function el(overrides: Partial<InteractiveElementEvidence>): InteractiveElementEvidence {
  return {
    tag: "a",
    text: "",
    ariaLabel: null,
    role: null,
    type: null,
    href: "#",
    disabled: false,
    visible: true,
    classes: "",
    testId: null,
    ...overrides,
  };
}

const BASE_HTML = `
  <html><head><meta name="viewport" content="width=device-width"></head>
  <body>
    <nav><a href="/a">A</a><a href="/b">B</a><a href="/c">C</a></nav>
    <input type="search" placeholder="Search" />
    <a href="tel:1234567890">Call us</a>
  </body></html>
`;

function makePage(interactiveElements: InteractiveElementEvidence[] | null): ScrapedPage {
  const $ = cheerio.load(BASE_HTML);
  return {
    html: BASE_HTML,
    $,
    title: "Shop",
    metaDescription: "",
    h1s: ["Shop"],
    h2s: [],
    images: [],
    links: [],
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements,
    headingAudit: { h1Count: 1, visibleH1Count: 1 },
    contrastAudit: null,
    evidenceComplete: interactiveElements !== null,
  };
}

// A raw cheerio-only count can't tell visible from hidden elements, which
// was the actual gap in the old check — these labels exist in the DOM
// regardless of visibility, so a test built only from HTML couldn't catch
// a regression back to visibility-blind counting. Driven entirely from
// interactiveElements instead, matching how the real check now reads it.
function manyDistinctCtaLabels(count: number, visible: boolean): InteractiveElementEvidence[] {
  return Array.from({ length: count }, (_, i) => el({ text: `Shop Collection ${i}`, visible }));
}

describe("ux-decision-paralysis: hardened CTA detection", () => {
  it("raises the finding only when many DISTINCT, VISIBLE CTA labels exist", () => {
    const page = makePage(manyDistinctCtaLabels(9, true));
    const { issues } = runUxChecks(page);
    const finding = issues.find((i) => i.id === "ux-decision-paralysis");
    expect(finding).toBeDefined();
    expect(finding!.sourceLabel).toBe("internal-heuristic");
    expect(finding!.confidence).toBeLessThanOrEqual(60);
    // Must not overclaim a confirmed hierarchy/competition defect.
    expect(finding!.title.toLowerCase()).not.toContain("competing");
  });

  it("does not raise the finding when distinct visible CTA count is at or below the threshold", () => {
    const page = makePage(manyDistinctCtaLabels(5, true));
    const { issues } = runUxChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("ux-decision-paralysis");
  });

  it("does not count hidden elements toward the distinct-label total", () => {
    // 10 distinct labels exist in the DOM, but only 3 are visible — must
    // not fire, since the old raw-cheerio count would have counted all 10.
    const hidden = manyDistinctCtaLabels(10, false);
    const visible = manyDistinctCtaLabels(3, true).map((e, i) => ({ ...e, text: `Visible CTA ${i}` }));
    const page = makePage([...hidden, ...visible]);
    const { issues } = runUxChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("ux-decision-paralysis");
  });

  it("withholds the finding and discloses a limitation when interactiveElements is unavailable", () => {
    const page = makePage(null);
    const { issues, limitations } = runUxChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("ux-decision-paralysis");
    // Specifically the decision-paralysis limitation, not just any
    // CTA-related one (ux-no-cta's own limitation also fires on this
    // fixture and would otherwise make this assertion pass vacuously).
    expect(limitations.some((l) => l.toLowerCase().includes("distinct, visible"))).toBe(true);
  });
});

describe("category-count reconciliation", () => {
  const makeIssue = (category: AuditIssue["category"], id: string): AuditIssue => ({
    id,
    category,
    metric: "Trust Coverage",
    severity: "low",
    pageUrl: "https://example.com",
    title: "x",
    observation: "x",
    evidence: { type: "structural", detail: "x" },
    behavioralExplanation: "x",
    businessImplication: "x",
    businessImpact: "low",
    confidence: 70,
    effort: "low",
    recommendation: "x",
    sourceLabel: "internal-heuristic",
  });

  it("the sum of per-category counts always equals the total issue count", () => {
    const issues = [
      makeIssue("SEO", "a"),
      makeIssue("SEO", "b"),
      makeIssue("UX", "c"),
      makeIssue("Trust", "d"),
      makeIssue("Performance", "e"),
    ];
    const summary = categorySummary(issues);
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(issues.length);
  });

  it("holds for any category count (3 populated categories, not a multiple of a 2 or 4 column grid)", () => {
    const issues = [makeIssue("SEO", "a"), makeIssue("UX", "b"), makeIssue("Trust", "c")];
    const summary = categorySummary(issues);
    const populated = Object.values(summary).filter((c) => c > 0);
    expect(populated).toHaveLength(3);
    expect(Object.values(summary).reduce((a, b) => a + b, 0)).toBe(issues.length);
  });
});
