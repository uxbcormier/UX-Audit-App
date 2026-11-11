// Vercel's env var UI (and whatever clipboard flow fed it) has repeatedly
// been observed to carry invisible characters into a pasted secret —
// invisible in the dashboard, but enough to break anything that uses the
// raw value in an HTTP header (Stripe's SDK throws `ERR_INVALID_CHAR` on
// exactly this). This has recurred multiple times despite two earlier
// attempts to fix it: a plain .trim() (doesn't help — the stray
// character(s) aren't confined to the edges), then a regex enumerating
// specific invisible Unicode codepoints (​-‍, ⁠, ﻿,
// ­) — except that attempt accidentally typed the LITERAL invisible
// characters into the regex source instead of \u-escaped sequences, making
// it impossible to verify by reading the file and fragile to any tool or
// transfer silently altering a byte.
//
// Rather than enumerate specific invisible characters a third time (and
// risk missing some other one Vercel's paste path introduces), this
// allowlists: every secret this app reads (API keys, connection strings,
// URLs, webhook signing secrets) is always plain printable ASCII, so
// stripping anything outside that range is both safe and exhaustive — it
// cannot miss a stray character the way an enumerated denylist can.
const NON_PRINTABLE_ASCII = /[^\x21-\x7E]/g;

export function trimmedEnv(name: string): string | undefined {
  return process.env[name]?.replace(NON_PRINTABLE_ASCII, "");
}

// Stripe's success_url/cancel_url/images params (and any link embedded in
// an email) must be absolute URLs with a scheme. Two real failure modes
// found in production: `trimmedEnv(...) ?? fallback` only falls back on
// null/undefined, not on an empty string (a blank env var in Vercel
// silently produced a relative URL), and a value set without "https://"
// (an easy paste mistake — "yourapp.vercel.app" instead of
// "https://yourapp.vercel.app") isn't absolute either. This was first
// fixed only in the checkout route, then found duplicated (unfixed) in the
// webhook handler that builds the report-ready email's link — centralized
// here so there's one implementation to fix, not one per call site.
export function resolveBaseUrl(): string {
  const raw = trimmedEnv("NEXT_PUBLIC_BASE_URL");
  const value = raw && raw.length > 0 ? raw : "http://localhost:3000";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}
