import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";
import type { ContrastAudit } from "../scraper";
import { runAccessibilityChecks } from "../checks/accessibility";

function makePage(html: string, contrastAudit: ContrastAudit | null = null): ScrapedPage {
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: $("title").text().trim(),
    metaDescription: "",
    h1s: $("h1").map((_, el) => $(el).text().trim()).get(),
    h2s: [],
    images: [],
    links: [],
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: [],
    headingAudit: { h1Count: 1, visibleH1Count: 1 },
    contrastAudit,
    evidenceComplete: true,
  };
}

describe("a11y-missing-lang", () => {
  it("fires when <html> has no lang attribute", () => {
    const page = makePage(`<html><body><h1>Hi</h1></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    const finding = issues.find((i) => i.id === "a11y-missing-lang");
    expect(finding).toBeDefined();
    expect(finding!.researchContext?.[0]?.url).toContain("w3.org");
  });

  it("does not fire when <html lang> is set", () => {
    const page = makePage(`<html lang="en"><body><h1>Hi</h1></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-missing-lang");
  });
});

describe("a11y-unlabeled-inputs", () => {
  it("fires for an input with no label, aria-label, or wrapping label", () => {
    const page = makePage(
      `<html lang="en"><body><form><input type="text" name="email" /></form></body></html>`
    );
    const { issues } = runAccessibilityChecks(page);
    const finding = issues.find((i) => i.id === "a11y-unlabeled-inputs");
    expect(finding).toBeDefined();
    expect(finding!.evidence.value).toBe(1);
  });

  it("does not fire when the input has a <label for>", () => {
    const page = makePage(
      `<html lang="en"><body><form><label for="email">Email</label><input id="email" type="text" /></form></body></html>`
    );
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unlabeled-inputs");
  });

  it("does not fire when the input is wrapped in a <label>", () => {
    const page = makePage(
      `<html lang="en"><body><form><label>Email <input type="text" /></label></form></body></html>`
    );
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unlabeled-inputs");
  });

  it("does not fire when the input has an aria-label", () => {
    const page = makePage(
      `<html lang="en"><body><form><input type="text" aria-label="Email address" /></form></body></html>`
    );
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unlabeled-inputs");
  });

  it("ignores hidden/submit/button inputs entirely", () => {
    const page = makePage(
      `<html lang="en"><body><form><input type="hidden" name="token" /><input type="submit" value="Go" /></form></body></html>`
    );
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unlabeled-inputs");
  });
});

describe("a11y-unnamed-interactive-element", () => {
  it("fires for a link with no text, aria-label, or image alt", () => {
    const page = makePage(`<html lang="en"><body><a href="/cart"><svg></svg></a></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).toContain("a11y-unnamed-interactive-element");
  });

  it("does not fire when the link has an aria-label", () => {
    const page = makePage(`<html lang="en"><body><a href="/cart" aria-label="View cart"><svg></svg></a></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unnamed-interactive-element");
  });

  it("does not fire when the link has a labeled image inside it", () => {
    const page = makePage(`<html lang="en"><body><a href="/cart"><img src="/cart.svg" alt="Cart" /></a></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unnamed-interactive-element");
  });

  it("does not fire for a link with visible text", () => {
    const page = makePage(`<html lang="en"><body><a href="/cart">Cart</a></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-unnamed-interactive-element");
  });
});

describe("a11y-non-descriptive-links", () => {
  it("fires for a link whose entire text is 'Click Here'", () => {
    const page = makePage(`<html lang="en"><body><a href="/terms">Click Here</a></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    const finding = issues.find((i) => i.id === "a11y-non-descriptive-links");
    expect(finding).toBeDefined();
    expect(finding!.researchContext?.[0]?.url).toContain("w3.org");
  });

  it("does not fire for descriptive link text", () => {
    const page = makePage(`<html lang="en"><body><a href="/terms">Read our return policy</a></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-non-descriptive-links");
  });
});

describe("a11y-heading-hierarchy-skip", () => {
  it("fires when an H1 is followed directly by an H3", () => {
    const page = makePage(`<html lang="en"><body><h1>Title</h1><h3>Sub</h3></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).toContain("a11y-heading-hierarchy-skip");
  });

  it("does not fire for sequential heading levels", () => {
    const page = makePage(`<html lang="en"><body><h1>Title</h1><h2>Sub</h2><h3>Sub-sub</h3></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-heading-hierarchy-skip");
  });
});

describe("a11y-duplicate-ids", () => {
  it("fires when an id is used on more than one element", () => {
    const page = makePage(`<html lang="en"><body><div id="main">A</div><div id="main">B</div></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).toContain("a11y-duplicate-ids");
  });

  it("does not fire when all ids are unique", () => {
    const page = makePage(`<html lang="en"><body><div id="main">A</div><div id="footer">B</div></body></html>`);
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-duplicate-ids");
  });
});

describe("a11y-low-contrast-text", () => {
  const BASE_HTML = `<html lang="en"><body><h1>Shop</h1></body></html>`;

  it("withholds the finding and discloses a limitation when the contrast capture failed", () => {
    const page = makePage(BASE_HTML, null);
    const { issues, limitations } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-low-contrast-text");
    expect(limitations.some((l) => l.toLowerCase().includes("contrast"))).toBe(true);
  });

  it("withholds the finding when too little text was sampled", () => {
    const page = makePage(BASE_HTML, { totalSampled: 2, failureCount: 2, failureExamples: [] });
    const { issues, limitations } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-low-contrast-text");
    expect(limitations.some((l) => l.toLowerCase().includes("contrast"))).toBe(true);
  });

  it("fires once a fifth or more of sampled text fails the contrast ratio", () => {
    const page = makePage(BASE_HTML, {
      totalSampled: 10,
      failureCount: 3,
      failureExamples: ["Low contrast example"],
    });
    const { issues } = runAccessibilityChecks(page);
    const finding = issues.find((i) => i.id === "a11y-low-contrast-text");
    expect(finding).toBeDefined();
    expect(finding!.evidence.examples).toContain("Low contrast example");
    expect(finding!.researchContext?.[0]?.url).toContain("w3.org");
  });

  it("does not fire below the failure ratio threshold", () => {
    const page = makePage(BASE_HTML, { totalSampled: 10, failureCount: 1, failureExamples: [] });
    const { issues } = runAccessibilityChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("a11y-low-contrast-text");
  });
});

describe("research citation integrity (accessibility citations)", () => {
  it("every new accessibility citation has a real w3.org url", async () => {
    const { RESEARCH_LIBRARY } = await import("../research");
    const a11yKeys = ["wcagLanguageOfPage", "wcagLinkPurpose", "wcagNameRoleValue", "wcagContrastMinimum"] as const;
    for (const key of a11yKeys) {
      const citation = RESEARCH_LIBRARY[key];
      expect(citation.url).toBeTruthy();
      expect(citation.url!.startsWith("https://www.w3.org/")).toBe(true);
    }
  });
});
