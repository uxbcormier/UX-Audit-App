import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";
import { runSeoChecks } from "../checks/seo";
import { runTrustChecks } from "../checks/trust";
import { runUxChecks } from "../checks/ux";

// These three checks were specifically called out as suspect ("No H1
// heading found", "No trust badges or payment icons", and implicitly the
// CTA check from the same false-negative risk class): a confident "X is
// missing" claim built on a DOM capture that may itself have been
// incomplete. This verifies the gate added to prevent that — the same
// discipline already applied to the Add to Cart detector.
function makeHomepage(html: string, evidenceComplete: boolean): ScrapedPage {
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
    links: $("a")
      .map((_, el) => ({ href: $(el).attr("href") ?? "", text: $(el).text().trim() }))
      .get(),
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: evidenceComplete ? [] : null,
    headingAudit: evidenceComplete ? { h1Count: h1s.length, visibleH1Count: h1s.length } : null,
    evidenceComplete,
  };
}

const BARE_HOMEPAGE_HTML = `<html><head><title>Shop</title></head><body><p>Welcome</p></body></html>`;

describe("evidence-completeness gating on 'confirmed absence' findings", () => {
  it("seo-missing-h1: raises the issue when evidence is complete and no H1 exists", () => {
    const page = makeHomepage(BARE_HOMEPAGE_HTML, true);
    const { issues, limitations } = runSeoChecks(page);
    expect(issues.map((i) => i.id)).toContain("seo-missing-h1");
    expect(limitations).toHaveLength(0);
  });

  it("seo-missing-h1: withholds the issue and discloses a limitation when evidence is incomplete", () => {
    const page = makeHomepage(BARE_HOMEPAGE_HTML, false);
    const { issues, limitations } = runSeoChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("seo-missing-h1");
    expect(limitations.some((l) => l.toLowerCase().includes("h1"))).toBe(true);
  });

  it("trust-no-payment-icons: raises the issue when evidence is complete and no icons exist", () => {
    const page = makeHomepage(BARE_HOMEPAGE_HTML, true);
    const { issues, limitations } = runTrustChecks(page);
    expect(issues.map((i) => i.id)).toContain("trust-no-payment-icons");
    expect(limitations).toHaveLength(0);
  });

  it("trust-no-payment-icons: withholds the issue and discloses a limitation when evidence is incomplete", () => {
    const page = makeHomepage(BARE_HOMEPAGE_HTML, false);
    const { issues, limitations } = runTrustChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
    expect(limitations.some((l) => l.toLowerCase().includes("payment-method icons"))).toBe(true);
  });

  it("ux-no-cta: raises the issue when evidence is complete and no CTA exists", () => {
    const page = makeHomepage(BARE_HOMEPAGE_HTML, true);
    const { issues, limitations } = runUxChecks(page);
    expect(issues.map((i) => i.id)).toContain("ux-no-cta");
    expect(limitations).toHaveLength(0);
  });

  it("ux-no-cta: withholds the issue and discloses a limitation when evidence is incomplete", () => {
    const page = makeHomepage(BARE_HOMEPAGE_HTML, false);
    const { issues, limitations } = runUxChecks(page);
    expect(issues.map((i) => i.id)).not.toContain("ux-no-cta");
    expect(limitations.some((l) => l.toLowerCase().includes("call-to-action"))).toBe(true);
  });

  it("never raises a defect for something that genuinely IS present, regardless of evidence completeness", () => {
    const richHtml = `
      <html><head><title>Shop</title></head><body>
        <h1>Welcome</h1>
        <a href="#">Shop Now</a>
        <div>Visa Mastercard PayPal Secure Checkout</div>
      </body></html>
    `;
    for (const complete of [true, false]) {
      const page = makeHomepage(richHtml, complete);
      const seo = runSeoChecks(page);
      const trust = runTrustChecks(page);
      const ux = runUxChecks(page);
      expect(seo.issues.map((i) => i.id)).not.toContain("seo-missing-h1");
      expect(trust.issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
      expect(trust.issues.map((i) => i.id)).not.toContain("trust-no-security-claim");
      expect(ux.issues.map((i) => i.id)).not.toContain("ux-no-cta");
    }
  });
});
