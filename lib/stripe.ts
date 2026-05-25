import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export const FULL_AUDIT_PRICE_CENTS = 12900; // $129.00
