// Vercel's env var UI (and whatever clipboard flow fed it) has repeatedly
// been observed to carry invisible characters into a pasted secret —
// invisible in the dashboard, but enough to break anything that uses the
// raw value in an HTTP header (Stripe's SDK throws `ERR_INVALID_CHAR` on
// exactly this). A plain .trim() alone didn't fix it — the error persisted
// identically after a careful re-paste, which means the stray character(s)
// aren't confined to the edges (trim only strips leading/trailing), so this
// strips whitespace and invisible/zero-width/control characters anywhere in
// the string. Safe for every secret this app reads — none of them (API
// keys, connection strings, URLs) ever legitimately contain whitespace.
const INVISIBLE_OR_WHITESPACE = /[\s​-‍⁠﻿­]/g;

export function trimmedEnv(name: string): string | undefined {
  return process.env[name]?.replace(INVISIBLE_OR_WHITESPACE, "");
}
