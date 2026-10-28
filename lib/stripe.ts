import Stripe from "stripe";
import { trimmedEnv } from "./env";

let stripeClient: Stripe | undefined;

// A real Stripe secret key is always "sk_test_" or "sk_live_" followed by
// ~99 more characters. If it comes out shorter than that after
// sanitization, the stored env var itself is incomplete/truncated at the
// source (a bad paste into Vercel, most likely) — not something
// trimmedEnv's character-stripping can cause, since a real key is plain
// ASCII start to finish. Fail with a clear, specific log line instead of
// letting Stripe's own "Invalid API Key provided: sk_test_" error (which
// looks identical to the invisible-character bug at a glance) be the only
// signal — that ambiguity cost real debugging time already.
const MIN_PLAUSIBLE_KEY_LENGTH = 40;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = trimmedEnv("STRIPE_SECRET_KEY");
    if (!key || key.length < MIN_PLAUSIBLE_KEY_LENGTH) {
      console.error(
        `STRIPE_SECRET_KEY is missing or implausibly short after sanitization (length: ${key?.length ?? 0}). ` +
          "This means the value stored in Vercel's environment variables is incomplete, not a sanitization bug — " +
          "delete and re-paste it fresh from the Stripe dashboard."
      );
    }
    stripeClient = new Stripe(key!, {
      apiVersion: "2026-04-22.dahlia",
    });
  }
  return stripeClient;
}

export const FULL_AUDIT_PRICE_CENTS = 12900; // $129.00
