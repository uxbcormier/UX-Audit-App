import type { ScrapedPage } from "./scraper";
import { discoverSitemapUrls } from "./sitemap";
import { fetchRobotsRules } from "./robots";
import { normalizeUrl } from "./urlNormalize";
import { guessUrlPriority, type UrlPriorityHint } from "./pageClassification";

// How many of the crawl budget's slots to reserve for each page type,
// before any leftover slots are filled with whatever else was discovered.
// Reflects Issue 1's stated priority: several product and collection pages
// (the bulk of a real ecommerce site's unique content), one each of the
// singular supporting pages. Never includes "checkout" — a publicly
// reachable checkout page is still a payment flow, and the conservative
// default is to never navigate into one, even read-only.
const MAX_PER_TYPE: Partial<Record<UrlPriorityHint, number>> = {
  product: 4,
  collection: 3,
  cart: 1,
  search: 1,
  about: 1,
  contact: 1,
  "shipping-returns": 1,
  faq: 1,
};

const PRIORITY_ORDER: UrlPriorityHint[] = [
  "product",
  "collection",
  "cart",
  "search",
  "about",
  "contact",
  "shipping-returns",
  "faq",
  "unknown",
];

export interface CrawlCandidate {
  url: string;
  priorityHint: UrlPriorityHint;
  discoveredVia: "sitemap" | "homepage-link";
}

export interface DiscoveryResult {
  // Already ordered and capped to `budget` — ready to crawl in this order.
  candidates: CrawlCandidate[];
  // Every in-scope, normalized, non-homepage URL found, independent of
  // whether it ended up crawled, skipped, or excluded by budget — this is
  // the real "N pages discovered" number for the coverage summary.
  totalDiscovered: number;
  sitemapFound: boolean;
  // Discovered, in-scope, but robots.txt disallows the path for our
  // user-agent — never added to `candidates`.
  disallowedByRobots: string[];
  // Discovered, in-scope, allowed by robots.txt, but a checkout URL —
  // never crawled by design (see MAX_PER_TYPE's comment), independent of
  // the crawl budget.
  excludedCheckoutUrls: string[];
  // Discovered, in-scope, robots-allowed, non-checkout, but not selected
  // into `candidates` because its page type's quota or the overall budget
  // was already full.
  excludedByBudgetUrls: string[];
}

// Builds the ranked crawl queue from two sources: the site's own sitemap
// (authoritative when present) and links found on the homepage (the
// fallback that keeps a site with no sitemap, or an incomplete one, still
// discoverable — see AGENTS.md's "don't rely exclusively on the sitemap"
// requirement). Never crawls checkout, never submits anything, never
// visits another domain.
export async function discoverPages(
  homepage: ScrapedPage,
  baseUrl: string,
  budget: number
): Promise<DiscoveryResult> {
  const siteHostname = new URL(baseUrl).hostname;
  const robots = await fetchRobotsRules(baseUrl);
  const sitemap = await discoverSitemapUrls(baseUrl, robots.sitemapUrls);

  const seen = new Set<string>();
  const normalizedHomepage = normalizeUrl(baseUrl, baseUrl, { siteHostname });
  if (normalizedHomepage) seen.add(normalizedHomepage);

  const pool: CrawlCandidate[] = [];
  const disallowedByRobots: string[] = [];
  const excludedCheckoutUrls: string[] = [];
  let totalDiscovered = 0;

  function addCandidate(rawUrl: string, discoveredVia: CrawlCandidate["discoveredVia"], linkText: string) {
    const normalized = normalizeUrl(rawUrl, baseUrl, { siteHostname });
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    totalDiscovered++;

    const priorityHint = guessUrlPriority(normalized, linkText);
    if (priorityHint === "checkout") {
      excludedCheckoutUrls.push(normalized);
      return; // never crawled — see MAX_PER_TYPE's comment
    }

    const pathname = (() => {
      try {
        return new URL(normalized).pathname;
      } catch {
        return "/";
      }
    })();
    if (!robots.isAllowed(pathname)) {
      disallowedByRobots.push(normalized);
      return;
    }

    pool.push({ url: normalized, priorityHint, discoveredVia });
  }

  for (const sitemapUrl of sitemap.urls) {
    addCandidate(sitemapUrl, "sitemap", "");
  }
  for (const link of homepage.links) {
    if (link.href) addCandidate(link.href, "homepage-link", link.text);
  }

  // Fill per-type quotas first (in PRIORITY_ORDER), then top up any
  // remaining budget with leftovers in original discovery order — this is
  // what gives a representative mix (several products AND a contact page)
  // instead of exhausting the whole budget on whichever type happened to
  // have the most links.
  const selected: CrawlCandidate[] = [];
  const used = new Set<CrawlCandidate>();

  for (const type of PRIORITY_ORDER) {
    const quota = MAX_PER_TYPE[type] ?? Infinity;
    let takenForType = 0;
    for (const candidate of pool) {
      if (selected.length >= budget) break;
      if (takenForType >= quota) break;
      if (used.has(candidate)) continue;
      if (candidate.priorityHint !== type) continue;
      selected.push(candidate);
      used.add(candidate);
      takenForType++;
    }
    if (selected.length >= budget) break;
  }

  if (selected.length < budget) {
    for (const candidate of pool) {
      if (selected.length >= budget) break;
      if (used.has(candidate)) continue;
      selected.push(candidate);
      used.add(candidate);
    }
  }

  // Eligible (in-scope, robots-allowed, non-checkout) but not selected —
  // either a per-type quota or the overall budget was already full. Kept
  // by real URL (not just a count) so the coverage report can show exactly
  // which pages the budget left out, not just how many.
  const excludedByBudgetUrls = pool.filter((c) => !used.has(c)).map((c) => c.url);

  return {
    candidates: selected,
    totalDiscovered,
    sitemapFound: sitemap.found,
    disallowedByRobots,
    excludedCheckoutUrls,
    excludedByBudgetUrls,
  };
}
