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
