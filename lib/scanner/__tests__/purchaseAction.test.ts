import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import type { ScrapedPage, InteractiveElementEvidence } from "../scraper";
import { classifyPage } from "../pageClassification";
import { detectPurchaseAction } from "../purchaseAction";
import { runProductChecks } from "../checks/product";

// Builds a ScrapedPage fixture the same shape scraper.ts produces, without
// a real browser — exactly what Phase 7 of the accuracy spec asks for:
// saved HTML/DOM fixtures and mocked evidence, not live network calls.
function makePage(html: string, interactiveElements: InteractiveElementEvidence[] | null): ScrapedPage {
  const $ = cheerio.load(html);
  return {
    html,
    $,
    title: $("title").text().trim(),
    metaDescription: $('meta[name="description"]').attr("content") ?? "",
    h1s: $("h1")
      .map((_, el) => $(el).text().trim())
      .get(),
    h2s: $("h2")
      .map((_, el) => $(el).text().trim())
      .get(),
    images: [],
    links: $("a")
      .map((_, el) => ({ href: $(el).attr("href") ?? "", text: $(el).text().trim() }))
      .get(),
    hasSSL: true,
    statusCode: 200,
    responseTimeMs: 150,
    screenshotDataUrl: null,
    interactiveElements,
  };
}

function el(overrides: Partial<InteractiveElementEvidence>): InteractiveElementEvidence {
  return {
    tag: "button",
    text: "",
    ariaLabel: null,
    role: null,
    type: null,
    href: null,
    disabled: false,
    visible: true,
    classes: "",
    testId: null,
    ...overrides,
  };
}

const PRODUCT_URL = "https://example.com/products/widget";
const PRODUCT_HTML = `
<html><body>
  <h1>Widget</h1>
  <div class="price">$49.99</div>
  <div class="reviews">4.5 stars, 120 verified buyer reviews</div>
  <div class="shipping">Ships within 3-5 business days</div>
</body></html>
`;

describe("page classification", () => {
  it("classifies a product-shaped page as product with high confidence", () => {
    const page = makePage(PRODUCT_HTML, []);
    const result = classifyPage(page, PRODUCT_URL);
    expect(result.pageType).toBe("product");
    expect(result.confidence).toBeGreaterThanOrEqual(50);
  });

  it("classifies the site root as homepage, not product", () => {
    const html = `<html><body><h1>Shop</h1><nav>Women Men Kids</nav></body></html>`;
    const page = makePage(html, []);
    const result = classifyPage(page, "https://example.com/");
    expect(result.pageType).toBe("homepage");
  });

  it("classifies a many-price grid as collection, not product", () => {
    const html = `<html><body>
      <div>$10</div><div>$20</div><div>$30</div><div>$40</div><div>$50</div><div>$60</div>
    </body></html>`;
    const page = makePage(html, []);
    const result = classifyPage(page, "https://example.com/collections/all");
    expect(result.pageType).toBe("collection");
  });
});

describe("detectPurchaseAction", () => {
  // Scenario 1: visible, enabled "Add to Cart" button.
  it("detects a visible, enabled Add to Cart button", () => {
    const page = makePage(PRODUCT_HTML, [el({ text: "Add to Cart" })]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("present");
  });

  // Scenario 2: visible, enabled "Add to Bag" button.
  it("detects a visible, enabled Add to Bag button", () => {
    const page = makePage(PRODUCT_HTML, [el({ text: "Add to Bag" })]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("present");
  });

  // Scenario 3: custom-styled button with only an accessible name, no text.
  it("detects a purchase action via aria-label when visible text is empty (icon button)", () => {
    const page = makePage(PRODUCT_HTML, [el({ text: "", ariaLabel: "Add to bag" })]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("present");
  });

  // Scenario 4: the exact Canada Goose shape — button disabled until a
  // required variant (size) is selected. Must not be a defect.
  it("treats a button disabled pending required variant selection as present_but_disabled, not missing", () => {
    const page = makePage(PRODUCT_HTML, [
      el({ text: "Select Size", disabled: false }),
      el({ text: "Add to Bag", disabled: true }),
    ]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(["present", "present_but_disabled"]).toContain(result.status);
  });

  // Scenario 5: a genuine product page with no purchase action anywhere —
  // the one case a definitive "not_detected" is actually warranted.
  it("returns not_detected when no purchase action exists on a confidently classified product page", () => {
    const page = makePage(PRODUCT_HTML, [
      el({ text: "Wishlist" }),
      el({ text: "Share" }),
      el({ tag: "a", href: "/", text: "Home" }),
    ]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("not_detected");
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Scenario 8: a homepage must never receive a missing-purchase-action claim.
  it("returns not_applicable on a homepage, never not_detected", () => {
    const html = `<html><body><h1>Shop</h1></body></html>`;
    const page = makePage(html, []);
    const result = detectPurchaseAction(page, classifyPage(page, "https://example.com/"));
    expect(result.status).toBe("not_applicable");
  });

  // Scenario 9: a collection/category page with product cards shouldn't
  // require a PDP-specific purchase action.
  it("returns not_applicable on a collection page", () => {
    const html = `<html><body>
      <div>$10</div><div>$20</div><div>$30</div><div>$40</div><div>$50</div><div>$60</div>
    </body></html>`;
    const page = makePage(html, []);
    const result = detectPurchaseAction(page, classifyPage(page, "https://example.com/collections/all"));
    expect(result.status).toBe("not_applicable");
  });

  // Scenario 10: the button exists in the DOM but isn't visibly rendered —
  // must not be reported as a confirmed defect.
  it("returns unable_to_verify when a matching element exists but isn't visible", () => {
    const page = makePage(PRODUCT_HTML, [el({ text: "Add to Cart", visible: false })]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("unable_to_verify");
  });

  // Scenario 11: unrelated buttons (wishlist, size guide, quick view, nav)
  // must never be mistaken for a purchase action.
  it("does not mistake wishlist/size-guide/quick-view/nav buttons for a purchase action", () => {
    const page = makePage(PRODUCT_HTML, [
      el({ text: "Add to Wishlist" }),
      el({ text: "Size Guide" }),
      el({ text: "Quick View" }),
      el({ tag: "a", href: "/account", text: "My Account" }),
    ]);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("not_detected");

    // Same unrelated buttons, but now a real one is also present — proves
    // the unrelated ones don't interfere with correctly finding the real one.
    const pageWithReal = makePage(PRODUCT_HTML, [
      el({ text: "Add to Wishlist" }),
      el({ text: "Size Guide" }),
      el({ text: "Add to Cart" }),
    ]);
    const resultWithReal = detectPurchaseAction(pageWithReal, classifyPage(pageWithReal, PRODUCT_URL));
    expect(resultWithReal.status).toBe("present");
  });

  // Scenario 12: evidence collection incomplete (in-browser evaluate
  // failed) — must fall back conservatively, never claim a confirmed defect.
  it("never emits not_detected when interactiveElements evidence is incomplete", () => {
    const page = makePage(PRODUCT_HTML, null);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).not.toBe("not_detected");
  });

  it("still recognizes a purchase action from the static HTML fallback when evidence is incomplete", () => {
    const html = PRODUCT_HTML.replace("</body>", `<button>Add to Cart</button></body>`);
    const page = makePage(html, null);
    const result = detectPurchaseAction(page, classifyPage(page, PRODUCT_URL));
    expect(result.status).toBe("present");
  });
});

describe("runProductChecks — the exact Canada Goose false-positive regression", () => {
  // Reproduces the real Harrier Fleece Jacket PDP shape that was
  // misreported as "No Add to Cart button found": no literal "Add to Bag"
  // text anywhere because the page is size-gated, with "Select Size" as the
  // real, functioning primary CTA, plus "Ships within 3-7 business days"
  // and review language present.
  const canadaGooseHtml = `
    <html><body>
      <h1>Men's Harrier Fleece Jacket</h1>
      <div class="price">$850</div>
      <div class="variant-picker">
        <button class="size-select-trigger">Select Size</button>
      </div>
      <div class="shipping-note">Ships within 3-7 business days.</div>
      <div class="reviews">4.5 stars, 120 verified buyer reviews</div>
    </body></html>
  `;

  it("does not raise product-no-cta on the Canada Goose size-gated PDP shape", () => {
    const page = makePage(canadaGooseHtml, [el({ text: "Select Size" })]);
    const url = "https://canadagoose.com/en-us/products/harrier-fleece-jacket-7252mt";
    const { issues, limitations } = runProductChecks(page, url, classifyPage(page, url));
    expect(issues.map((i) => i.id)).not.toContain("product-no-cta");
    expect(limitations).toHaveLength(0);
  });

  it("still raises product-no-cta on a confidently-classified product page with truly no purchase action", () => {
    const page = makePage(PRODUCT_HTML, [el({ text: "Wishlist" })]);
    const { issues } = runProductChecks(page, PRODUCT_URL, classifyPage(page, PRODUCT_URL));
    expect(issues.map((i) => i.id)).toContain("product-no-cta");
  });
});
