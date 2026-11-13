import * as cheerio from "cheerio";

// Caps keep a pathological sitemap (a site with a 50,000-entry sitemap
// index, or a sitemap that somehow points back at itself) from eating the
// scan's time budget before crawling has even started — we only need a
// representative pool of URLs to choose from, not every URL the site has.
const MAX_SITEMAP_FILES = 5;
const MAX_URLS_COLLECTED = 500;
const FETCH_TIMEOUT_MS = 6000;

async function fetchXml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (!res.ok) return null;
      return await res.text();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

export interface SitemapResult {
  found: boolean;
  urls: string[];
}

// Discovers sitemap URLs the same way a real crawler does: robots.txt's own
// Sitemap: directives first (the authoritative hint when present), then the
// two conventional default locations as a fallback. A sitemap INDEX (a
// sitemap of sitemaps) is followed one level deep — real multi-sitemap
// stores commonly split by type (products.xml, pages.xml, collections.xml),
// so not following the index at all would miss most of the site; going
// deeper than one level risks the same runaway-fetch problem the caps above
// exist to prevent, for a diminishing-returns benefit.
export async function discoverSitemapUrls(baseUrl: string, robotsSitemapUrls: string[]): Promise<SitemapResult> {
  const candidateSitemaps = [...robotsSitemapUrls];
  if (candidateSitemaps.length === 0) {
    candidateSitemaps.push(
      new URL("/sitemap.xml", baseUrl).toString(),
      new URL("/sitemap_index.xml", baseUrl).toString()
    );
  }

  const urls = new Set<string>();
  let found = false;
  let filesFetched = 0;

  // A small queue rather than recursion — easier to cap breadth-first
  // (sitemap index entries first, each index's own file second) without
  // worrying about recursion depth bugs.
  const queue = [...candidateSitemaps];
  const visited = new Set<string>();

  while (queue.length > 0 && filesFetched < MAX_SITEMAP_FILES && urls.size < MAX_URLS_COLLECTED) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    const xml = await fetchXml(sitemapUrl);
    if (!xml) continue;
    filesFetched++;
    found = true;

    const $ = cheerio.load(xml, { xmlMode: true });

    // A sitemap index: <sitemapindex><sitemap><loc>...
    const nestedSitemaps = $("sitemapindex > sitemap > loc")
      .map((_, el) => $(el).text().trim())
      .get();
    for (const nested of nestedSitemaps) {
      if (nested && !visited.has(nested)) queue.push(nested);
    }

    // A regular urlset: <urlset><url><loc>...
    const pageUrls = $("urlset > url > loc")
      .map((_, el) => $(el).text().trim())
      .get();
    for (const pageUrl of pageUrls) {
      if (urls.size >= MAX_URLS_COLLECTED) break;
      if (pageUrl) urls.add(pageUrl);
    }
  }

  return { found, urls: [...urls] };
}
