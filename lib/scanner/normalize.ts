import type { ScrapedPage } from "./scraper";

// Checking a multi-word phrase against raw HTML source (or even against
// cheerio's .text() without normalizing) breaks the moment a real site
// splits that phrase across separate tags for styling — e.g. "Secure
// Checkout" rendered as <span>Secure</span> <span>Checkout</span> has no
// contiguous "Secure Checkout" substring in the HTML source at all, and
// concatenated text can come back with embedded newlines/indentation
// instead of a single space. This produces the page's visible text with
// all of that collapsed to single spaces, so a plain literal-space regex
// reliably matches the phrase regardless of how the markup is structured —
// this is what every "does the page mention X" check should test against,
// not raw HTML and not a bare .text() call.
export function normalizedBodyText(page: ScrapedPage): string {
  return page.$("body").text().replace(/\s+/g, " ").trim();
}
