// Vercel's env var UI (and whatever clipboard flow fed it) has repeatedly
// been observed to carry a stray trailing newline/space into a pasted
// secret — invisible in the dashboard, but enough to break anything that
// uses the raw value in an HTTP header (Stripe's SDK throws
// `ERR_INVALID_CHAR` on exactly this). Trim defensively at every read site
// so this class of bug can't recur no matter how the value got pasted in.
export function trimmedEnv(name: string): string | undefined {
  return process.env[name]?.trim();
}
