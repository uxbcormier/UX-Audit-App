// URL normalization shared by discovery (sitemap + link crawling) so the
// same page reached two different ways (with/without a trailing slash, a
// tracking param, a #fragment, a different case in the host) is recognized
// as one URL rather than crawled or counted twice.

// Common analytics/tracking params that don't change what page loads —
// stripping them is what makes "same page, different query string" collapse
// to one URL instead of being treated as distinct pages.
const TRACKING_PARAM_PATTERN = /^(utm_|gclid$|fbclid$|msclkid$|mc_eid$|mc_cid$|ref$|ref_src$|igshid$)/i;

export interface NormalizeOptions {
  // Only URLs on this hostname (or its www. variant) are considered
  // in-scope — anything else is an external link, out of scope for a
  // same-domain crawl.
  siteHostname: string;
}

function sameRegistrableHost(hostname: string, siteHostname: string): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(hostname) === strip(siteHostname);
}

// Returns null for anything that isn't a normalizable, in-scope, http(s)
// page URL: a different domain, a non-http(s) scheme (mailto:, tel:,
// javascript:), or a string that doesn't parse as a URL at all.
export function normalizeUrl(href: string, baseUrl: string, options: NormalizeOptions): string | null {
  let url: URL;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!sameRegistrableHost(url.hostname, options.siteHostname)) return null;

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  // Default ports are implicit — keeping them would make
  // "example.com" and "example.com:443" normalize to two different URLs
  // for what's actually the same page.
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  const keptParams = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAM_PATTERN.test(key));
  url.search = "";
  for (const [key, value] of keptParams) url.searchParams.append(key, value);

  // Trailing slash is cosmetic for anything but the root path.
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
