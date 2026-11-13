import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../scraper";
import type { MobileRenderAudit } from "../scraper";
import { classifySiteType } from "../pageClassification";
import { runTrustChecks } from "../checks/trust";
import { runUxChecks } from "../checks/ux";
import { runMobileChecks } from "../checks/mobile";

function makePage(html: string, links: { href: string; text: string }[] = []): ScrapedPage {
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: $("title").text().trim(),
    metaDescription: "",
    h1s: $("h1").map((_, el) => $(el).text().trim()).get(),
    h2s: [],
    images: [],
    links,
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 100,
    screenshotDataUrl: null,
    interactiveElements: [],
    headingAudit: { h1Count: 1, visibleH1Count: 1 },
    evidenceComplete: true,
  };
}

describe("classifySiteType", () => {
  it("classifies as ecommerce whenever a real product page was found, regardless of homepage signals", () => {
    const page = makePage(`<html><body><h1>Acme Consulting</h1><p>We help businesses grow.</p></body></html>`);
    expect(classifySiteType(page, true)).toBe("ecommerce");
  });

  it("classifies a service/consultancy site with no price or cart signals as general", () => {
    const page = makePage(
      `<html><body><h1>Acme Consulting</h1><p>We help businesses grow.</p></body></html>`
    );
    expect(classifySiteType(page, false)).toBe("general");
  });

  it("classifies a booking/rental-style site (prices, no cart/shop link) as general — price alone isn't decisive", () => {
    const page = makePage(
      `<html><body><h1>Cozy Cabin Rental</h1><p>$120/night. $150/night for the lakeside room. $200/night for the whole house.</p></body></html>`
    );
    expect(classifySiteType(page, false)).toBe("general");
  });

  it("classifies as ecommerce when price density AND a cart link both appear on the homepage", () => {
    const page = makePage(
      `<html><body><h1>Acme Goods</h1><p>$20 widget. $35 gadget. $50 gizmo.</p></body></html>`,
      [{ href: "/cart", text: "Cart" }]
    );
    expect(classifySiteType(page, false)).toBe("ecommerce");
  });

  it("classifies as ecommerce when price density AND a shop link both appear on the homepage", () => {
    const page = makePage(
      `<html><body><h1>Acme Goods</h1><p>$20 widget. $35 gadget. $50 gizmo.</p></body></html>`,
      [{ href: "/collections/all", text: "Shop All" }]
    );
    expect(classifySiteType(page, false)).toBe("ecommerce");
  });
});

describe("ecommerce-only checks are gated by siteType", () => {
  const NO_SIGNALS_HTML = `<html><body><h1>Acme Consulting</h1><p>We help businesses grow.</p></body></html>`;

  it("trust-no-payment-icons does not fire on a general site", () => {
    const page = makePage(NO_SIGNALS_HTML);
    const { issues, limitations } = runTrustChecks(page, "general");
    expect(issues.map((i) => i.id)).not.toContain("trust-no-payment-icons");
    expect(limitations.join(" ")).not.toContain("payment-method icons");
  });

  it("trust-no-return-policy does not fire on a general site", () => {
    const page = makePage(NO_SIGNALS_HTML);
    const { issues, limitations } = runTrustChecks(page, "general");
    expect(issues.map((i) => i.id)).not.toContain("trust-no-return-policy");
    expect(limitations.join(" ")).not.toContain("return/refund policy");
  });

  it("trust-no-payment-icons and trust-no-return-policy still fire by default (ecommerce)", () => {
    const page = makePage(NO_SIGNALS_HTML);
    const { issues } = runTrustChecks(page);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("trust-no-payment-icons");
    expect(ids).toContain("trust-no-return-policy");
  });

  it("universal trust checks (reviews, privacy, about) still fire on a general site", () => {
    const page = makePage(NO_SIGNALS_HTML);
    const { issues } = runTrustChecks(page, "general");
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("trust-no-reviews");
    expect(ids).toContain("trust-no-privacy");
    expect(ids).toContain("trust-no-about");
  });

  it("ux-no-search does not fire on a general site", () => {
    const page = makePage(`<html><body><h1>Acme Consulting</h1><nav><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav></body></html>`);
    const { issues, limitations } = runUxChecks(page, "general");
    expect(issues.map((i) => i.id)).not.toContain("ux-no-search");
    expect(limitations.join(" ")).not.toContain("site search");
  });

  it("ux-no-search still fires by default (ecommerce) when no search input exists", () => {
    const page = makePage(`<html><body><h1>Acme Goods</h1><nav><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav></body></html>`);
    const { issues } = runUxChecks(page);
    expect(issues.map((i) => i.id)).toContain("ux-no-search");
  });

  it("service-site CTA language ('Book Now', 'Request a Quote') is recognized as a real CTA", () => {
    const page = makePage(
      `<html><body><h1>Acme Consulting</h1><a href="/book">Book Now</a></body></html>`
    );
    const { issues } = runUxChecks(page, "general");
    expect(issues.map((i) => i.id)).not.toContain("ux-no-cta");
  });
});

describe("runMobileChecks", () => {
  const BASE: MobileRenderAudit = {
    viewportWidth: 375,
    viewportHeight: 667,
    scrollWidth: 375,
    hasHorizontalOverflow: false,
    totalVisibleTapTargets: 10,
    undersizedTapTargetCount: 0,
    totalBodyTextSamples: 10,
    smallBodyTextSampleCount: 0,
  };

  it("withholds all findings and discloses a limitation when the mobile capture failed (null)", () => {
    const { issues, limitations } = runMobileChecks(null);
    expect(issues).toHaveLength(0);
    expect(limitations.some((l) => l.toLowerCase().includes("mobile"))).toBe(true);
  });

  it("raises no findings on a clean mobile render", () => {
    const { issues, limitations } = runMobileChecks(BASE);
    expect(issues).toHaveLength(0);
    expect(limitations).toHaveLength(0);
  });

  it("flags horizontal overflow when scrollWidth exceeds the viewport width", () => {
    const { issues } = runMobileChecks({ ...BASE, scrollWidth: 600, hasHorizontalOverflow: true });
    expect(issues.map((i) => i.id)).toContain("mobile-horizontal-overflow");
  });

  it("flags undersized tap targets once they're a third or more of visible targets", () => {
    const { issues } = runMobileChecks({
      ...BASE,
      totalVisibleTapTargets: 10,
      undersizedTapTargetCount: 4,
    });
    const finding = issues.find((i) => i.id === "mobile-small-tap-targets");
    expect(finding).toBeDefined();
    expect(finding!.researchContext?.[0]?.url).toContain("w3.org");
  });

  it("does not flag tap targets below the ratio threshold", () => {
    const { issues } = runMobileChecks({
      ...BASE,
      totalVisibleTapTargets: 10,
      undersizedTapTargetCount: 2,
    });
    expect(issues.map((i) => i.id)).not.toContain("mobile-small-tap-targets");
  });

  it("withholds the tap-target finding (as a limitation) when too few tap targets were sampled", () => {
    const { issues, limitations } = runMobileChecks({
      ...BASE,
      totalVisibleTapTargets: 1,
      undersizedTapTargetCount: 1,
    });
    expect(issues.map((i) => i.id)).not.toContain("mobile-small-tap-targets");
    expect(limitations.some((l) => l.toLowerCase().includes("tap target"))).toBe(true);
  });

  it("flags small body text once a third or more of sampled text is under the readable floor", () => {
    const { issues } = runMobileChecks({
      ...BASE,
      totalBodyTextSamples: 10,
      smallBodyTextSampleCount: 5,
    });
    expect(issues.map((i) => i.id)).toContain("mobile-small-text");
  });

  it("withholds the small-text finding (as a limitation) when too little text was sampled", () => {
    const { issues, limitations } = runMobileChecks({
      ...BASE,
      totalBodyTextSamples: 2,
      smallBodyTextSampleCount: 2,
    });
    expect(issues.map((i) => i.id)).not.toContain("mobile-small-text");
    expect(limitations.some((l) => l.toLowerCase().includes("text"))).toBe(true);
  });
});
