import { describe, it, expect } from "vitest";
import { parseRobots } from "../robots";

describe("parseRobots", () => {
  it("allows everything when there are no rules at all", () => {
    const rules = parseRobots("");
    expect(rules.isAllowed("/anything")).toBe(true);
  });

  it("respects a Disallow rule under the wildcard user-agent group", () => {
    const rules = parseRobots(`User-agent: *\nDisallow: /admin/`);
    expect(rules.isAllowed("/admin/settings")).toBe(false);
    expect(rules.isAllowed("/products/widget")).toBe(true);
  });

  it("an Allow rule can carve out an exception within a disallowed path", () => {
    const rules = parseRobots(`User-agent: *\nDisallow: /search\nAllow: /search/sitemap`);
    expect(rules.isAllowed("/search")).toBe(false);
    expect(rules.isAllowed("/search/results")).toBe(false);
    expect(rules.isAllowed("/search/sitemap")).toBe(true);
  });

  it("longest matching rule wins over a shorter one", () => {
    const rules = parseRobots(`User-agent: *\nAllow: /\nDisallow: /private/`);
    expect(rules.isAllowed("/private/data")).toBe(false);
    expect(rules.isAllowed("/public/data")).toBe(true);
  });

  it("prefers a GrafterBot-specific group over the wildcard group", () => {
    const rules = parseRobots(
      `User-agent: *\nDisallow: /\n\nUser-agent: GrafterBot\nDisallow: /admin/`
    );
    // The wildcard group disallows everything, but our own named group
    // (which only disallows /admin/) takes precedence over it entirely.
    expect(rules.isAllowed("/products/widget")).toBe(true);
    expect(rules.isAllowed("/admin/")).toBe(false);
  });

  it("supports a wildcard (*) within a path pattern", () => {
    const rules = parseRobots(`User-agent: *\nDisallow: /*.pdf$`);
    expect(rules.isAllowed("/files/report.pdf")).toBe(false);
    expect(rules.isAllowed("/files/report.pdf.html")).toBe(true);
  });

  it("an empty Disallow value means allow everything", () => {
    const rules = parseRobots(`User-agent: *\nDisallow:`);
    expect(rules.isAllowed("/anything")).toBe(true);
  });

  it("extracts Sitemap: directives regardless of where they appear", () => {
    const rules = parseRobots(
      `Sitemap: https://example.com/sitemap.xml\nUser-agent: *\nDisallow: /admin/\nSitemap: https://example.com/sitemap-2.xml`
    );
    expect(rules.sitemapUrls).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/sitemap-2.xml",
    ]);
  });

  it("ignores comments and blank lines", () => {
    const rules = parseRobots(`# a comment\n\nUser-agent: *\n# another comment\nDisallow: /admin/`);
    expect(rules.isAllowed("/admin/")).toBe(false);
    expect(rules.isAllowed("/other")).toBe(true);
  });
});
