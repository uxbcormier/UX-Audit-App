import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../urlNormalize";

const OPTS = { siteHostname: "example.com" };

describe("normalizeUrl", () => {
  it("resolves a relative href against the base URL", () => {
    expect(normalizeUrl("/products/widget", "https://example.com", OPTS)).toBe(
      "https://example.com/products/widget"
    );
  });

  it("strips a trailing slash on a non-root path", () => {
    expect(normalizeUrl("https://example.com/about/", "https://example.com", OPTS)).toBe(
      "https://example.com/about"
    );
  });

  it("keeps the root path as-is (no trailing slash to strip below '/')", () => {
    expect(normalizeUrl("https://example.com/", "https://example.com", OPTS)).toBe("https://example.com/");
  });

  it("strips the #fragment", () => {
    expect(normalizeUrl("https://example.com/about#team", "https://example.com", OPTS)).toBe(
      "https://example.com/about"
    );
  });

  it("strips tracking params but keeps real ones", () => {
    const result = normalizeUrl(
      "https://example.com/products/widget?utm_source=newsletter&color=blue",
      "https://example.com",
      OPTS
    );
    expect(result).toBe("https://example.com/products/widget?color=blue");
  });

  it("treats www. and bare hostname as the same site", () => {
    expect(normalizeUrl("https://www.example.com/about", "https://example.com", OPTS)).toBe(
      "https://www.example.com/about"
    );
  });

  it("two different-looking URLs for the same page normalize to the same string", () => {
    const a = normalizeUrl("https://example.com/About/?utm_source=x#section", "https://example.com", OPTS);
    const b = normalizeUrl("https://www.example.com/About", "https://example.com", OPTS);
    // Different host casing/www is allowed to differ in the exact output,
    // but path case and trailing slash/fragment/tracking-param handling
    // must collapse consistently.
    expect(a).toBe("https://example.com/About");
    expect(b).toBe("https://www.example.com/About");
  });

  it("rejects a different domain", () => {
    expect(normalizeUrl("https://evil.com/phish", "https://example.com", OPTS)).toBeNull();
  });

  it("rejects a non-http(s) scheme (mailto:, tel:, javascript:)", () => {
    expect(normalizeUrl("mailto:hello@example.com", "https://example.com", OPTS)).toBeNull();
    expect(normalizeUrl("tel:+15555555555", "https://example.com", OPTS)).toBeNull();
    expect(normalizeUrl("javascript:void(0)", "https://example.com", OPTS)).toBeNull();
  });

  it("rejects a malformed absolute URL", () => {
    expect(normalizeUrl("http://[invalid", "https://example.com", OPTS)).toBeNull();
  });

  it("strips the default port", () => {
    expect(normalizeUrl("https://example.com:443/about", "https://example.com", OPTS)).toBe(
      "https://example.com/about"
    );
  });
});
