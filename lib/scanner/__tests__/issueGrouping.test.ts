import { describe, it, expect } from "vitest";
import { groupIssuesAcrossPages, categorySummary } from "../index";
import type { AuditIssue } from "../types";

function makeIssue(overrides: Partial<AuditIssue> = {}): AuditIssue {
  return {
    id: "test-issue",
    category: "UX",
    metric: "Trust & Reassurance",
    severity: "low",
    pageUrl: "https://example.com",
    affectedPageCount: 1,
    affectedPageUrls: ["https://example.com"],
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
    ...overrides,
  };
}

describe("groupIssuesAcrossPages", () => {
  it("leaves a single-page finding untouched (affectedPageCount stays 1)", () => {
    const [result] = groupIssuesAcrossPages([makeIssue()]);
    expect(result.affectedPageCount).toBe(1);
    expect(result.affectedPageUrls).toEqual(["https://example.com"]);
  });

  it("merges the same check id found on multiple pages into one finding with an accurate count — does NOT silently drop the later occurrences", () => {
    const issues = [
      makeIssue({ pageUrl: "https://example.com/products/a", affectedPageUrls: ["https://example.com/products/a"] }),
      makeIssue({ pageUrl: "https://example.com/products/b", affectedPageUrls: ["https://example.com/products/b"] }),
      makeIssue({ pageUrl: "https://example.com/products/c", affectedPageUrls: ["https://example.com/products/c"] }),
    ];

    const grouped = groupIssuesAcrossPages(issues);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].affectedPageCount).toBe(3);
    expect(grouped[0].affectedPageUrls).toEqual([
      "https://example.com/products/a",
      "https://example.com/products/b",
      "https://example.com/products/c",
    ]);
  });

  it("keeps distinct check ids as separate findings", () => {
    const issues = [makeIssue({ id: "a" }), makeIssue({ id: "b" })];
    const grouped = groupIssuesAcrossPages(issues);
    expect(grouped.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("caps affectedPageUrls at 10 representative examples but the count reflects every affected page", () => {
    const issues = Array.from({ length: 15 }, (_, i) => {
      const url = `https://example.com/p${i}`;
      return makeIssue({ pageUrl: url, affectedPageUrls: [url] });
    });

    const [result] = groupIssuesAcrossPages(issues);
    expect(result.affectedPageCount).toBe(15);
    expect(result.affectedPageUrls).toHaveLength(10);
  });

  it("a confirmed real defect is never counted as more than one penalty source — grouping always reduces N same-id occurrences to exactly 1 finding", () => {
    const issues = Array.from({ length: 5 }, (_, i) =>
      makeIssue({ pageUrl: `https://example.com/p${i}`, severity: "critical" })
    );
    const grouped = groupIssuesAcrossPages(issues);
    expect(grouped).toHaveLength(1);
  });
});

describe("reconciliation invariants (Issue 7)", () => {
  it("category totals always sum to the total finding count after grouping", () => {
    const issues = [
      makeIssue({ id: "a", category: "SEO", pageUrl: "https://example.com/1" }),
      makeIssue({ id: "a", category: "SEO", pageUrl: "https://example.com/2" }),
      makeIssue({ id: "b", category: "Trust", pageUrl: "https://example.com/1" }),
      makeIssue({ id: "c", category: "Accessibility", pageUrl: "https://example.com/1" }),
    ];
    const grouped = groupIssuesAcrossPages(issues);
    const summary = categorySummary(grouped);
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(grouped.length);
    expect(grouped).toHaveLength(3); // "a" merged across 2 pages into 1
  });
});
