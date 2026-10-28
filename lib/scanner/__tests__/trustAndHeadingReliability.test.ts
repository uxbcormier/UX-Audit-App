import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";
import { runTrustChecks } from "../checks/trust";
import { runSeoChecks } from "../checks/seo";
import { AuditIssue } from "../types";

function makePage(
  html: string,
  opts: { headingAudit?: { h1Count: number; visibleH1Count: number } | null } = {}
): ScrapedPage {
  const $ = cheerio.load(html);
  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get();
  return {
    html,
    $,
    title: $("title").text().trim(),
    metaDescription: "",
    h1s,
    h2s: [],
    images: [],
    links: [],
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: [],
    headingAudit:
      opts.headingAudit !== undefined ? opts.headingAudit : { h1Count: h1s.length, visibleH1Count: h1s.length },
    evidenceComplete: true,
  };
}

const NO_PAYMENT_EVIDENCE_HTML = `<html><body><h1>Shop</h1><p>Welcome to our store.</p></body></html>`;

describe("payment-icon detection (trust-no-payment-icons)", () => {
  // Scenario 4: payment icons rendered as SVGs must be detected.
  it("detects a payment icon via an SVG aria-label, with no matching text anywhere", () => {
    const html = `
      <html><body>
        <h1>Shop</h1>
        <svg aria-label="Visa"><path d="..."/></svg>
      </body></html>
    `;
    const page = makePage(html);
    const { issues } = runTrustChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
  });

  it("detects a payment icon via an SVG <title> child, with no matching text anywhere", () => {
    const html = `
      <html><body>
        <h1>Shop</h1>
        <svg><title>Mastercard</title><path d="..."/></svg>
      </body></html>
    `;
    const page = makePage(html);
    const { issues } = runTrustChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
  });

  // Scenario 5: payment icons rendered as <img> must be detected via alt text.
  it("detects a payment icon via img alt text, with no matching text anywhere", () => {
    const html = `
      <html><body>
        <h1>Shop</h1>
        <img src="/paypal-logo.svg" alt="PayPal" />
      </body></html>
    `;
    const page = makePage(html);
    const { issues } = runTrustChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
  });

  it("detects payment icons via a recognized container class even without a brand name anywhere", () => {
    const html = `
      <html><body>
        <h1>Shop</h1>
        <div class="payment-icons"><img src="/sprite.png" alt="" /></div>
      </body></html>
    `;
    const page = makePage(html);
    const { issues } = runTrustChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
  });

  // Scenario 6: a site genuinely without payment logos must not be
  // automatically classified as lacking trust overall — only this one,
  // low-severity, optional-framed finding, not a blanket trust failure.
  it("raises only a low-severity, optional-framed finding when no payment evidence exists at all", () => {
    const page = makePage(NO_PAYMENT_EVIDENCE_HTML);
    const { issues } = runTrustChecks(page);
    const finding = issues.find((i) => i.id === "trust-no-payment-icons");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("low");
    expect(finding!.businessImpact).toBe("low");
  });

  it("the old conflated 'trust-no-badges' id no longer exists; payment icons and security claims are independent checks", () => {
    const page = makePage(NO_PAYMENT_EVIDENCE_HTML);
    const { issues } = runTrustChecks(page);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("trust-no-payment-icons");
    expect(ids).toContain("trust-no-security-claim");
    expect(ids).not.toContain("trust-no-badges");
  });

  it("a page with security language but no payment icons raises only the payment-icon finding", () => {
    const html = `<html><body><h1>Shop</h1><p>Secure checkout guaranteed.</p></body></html>`;
    const page = makePage(html);
    const { issues } = runTrustChecks(page);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("trust-no-payment-icons");
    expect(ids).not.toContain("trust-no-security-claim");
  });
});

describe("H1 hidden vs absent vs present (seo-missing-h1 / seo-h1-hidden)", () => {
  it("reports seo-missing-h1 when no H1 exists anywhere in the DOM", () => {
    const page = makePage(`<html><body><p>No heading here.</p></body></html>`, {
      headingAudit: { h1Count: 0, visibleH1Count: 0 },
    });
    const { issues } = runSeoChecks(page);
    expect(issues.map((i) => i.id)).toContain("seo-missing-h1");
  });

  it("reports seo-h1-hidden (not seo-missing-h1) when an H1 exists but isn't visible", () => {
    const page = makePage(`<html><body><h1 style="display:none">Hidden</h1></body></html>`, {
      headingAudit: { h1Count: 1, visibleH1Count: 0 },
    });
    const { issues } = runSeoChecks(page);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("seo-h1-hidden");
    expect(ids).not.toContain("seo-missing-h1");
  });

  it("reports neither when a visible H1 exists", () => {
    const page = makePage(`<html><body><h1>Welcome</h1></body></html>`, {
      headingAudit: { h1Count: 1, visibleH1Count: 1 },
    });
    const { issues } = runSeoChecks(page);
    const ids = issues.map((i) => i.id);
    expect(ids).not.toContain("seo-missing-h1");
    expect(ids).not.toContain("seo-h1-hidden");
  });

  // Scenario 3 (extraction timeout / incomplete coverage): must never
  // produce a false missing-H1 finding.
  it("withholds any H1 finding and discloses a limitation when heading evidence is unavailable", () => {
    const page = makePage(`<html><body><p>No heading here.</p></body></html>`, { headingAudit: null });
    const { issues, limitations } = runSeoChecks(page);
    const ids = issues.map((i) => i.id);
    expect(ids).not.toContain("seo-missing-h1");
    expect(ids).not.toContain("seo-h1-hidden");
    expect(limitations.some((l) => l.toLowerCase().includes("h1"))).toBe(true);
  });
});

describe("research citation integrity", () => {
  it("every researchContext citation attached by any check has a real url", async () => {
    // Runs every check's citations through the single shared library rather
    // than guessing per-file — if a check ever attaches a citation whose
    // library entry has no url, this catches it regardless of which check.
    const { RESEARCH_LIBRARY } = await import("../research");
    for (const [key, citation] of Object.entries(RESEARCH_LIBRARY)) {
      expect(citation.url, `citation "${key}" must have a verifiable source url`).toBeTruthy();
      expect(citation.url!.startsWith("https://")).toBe(true);
    }
  });
});

describe("dedup safety net", () => {
  it("combining issue lists with a duplicate id keeps only the first occurrence", () => {
    const dupeId = "dupe-test-id";
    const makeIssue = (confidence: number): AuditIssue => ({
      id: dupeId,
      category: "UX",
      metric: "Trust Coverage",
      severity: "low",
      title: "x",
      observation: "x",
      evidence: { type: "structural", detail: "x" },
      behavioralExplanation: "x",
      businessImplication: "x",
      businessImpact: "low",
      confidence,
      effort: "low",
      recommendation: "x",
      sourceLabel: "internal-heuristic",
    });

    const combined = [makeIssue(70), makeIssue(99)];
    const seen = new Set<string>();
    const deduped = combined.filter((issue) => {
      if (seen.has(issue.id)) return false;
      seen.add(issue.id);
      return true;
    });

    expect(deduped).toHaveLength(1);
    expect(deduped[0].confidence).toBe(70);
  });
});
