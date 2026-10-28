import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, FULL_AUDIT_PRICE_CENTS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { trimmedEnv } from "@/lib/env";

const schema = z.object({
  scanId: z.string().min(1),
  email: z.string().email(),
});

// Stripe's success_url/cancel_url/images params must be absolute URLs with
// a scheme, or checkout.sessions.create fails with "Not a valid URL." Two
// real failure modes found in production here: `trimmedEnv(...) ??
// fallback` only falls back on null/undefined, not on an empty string (a
// blank env var in Vercel silently produced a relative URL), and a value
// set without "https://" (an easy paste mistake — "yourapp.vercel.app"
// instead of "https://yourapp.vercel.app") isn't absolute either.
function resolveBaseUrl(): string {
  const raw = trimmedEnv("NEXT_PUBLIC_BASE_URL");
  const value = raw && raw.length > 0 ? raw : "http://localhost:3000";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { scanId, email } = parsed.data;

  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const baseUrl = resolveBaseUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Grafter — Full Audit Report",
            description: `Complete audit for ${scan.url} — all issues, revenue estimates, and fix recommendations.`,
            images: [`${baseUrl}/og-audit.png`],
          },
          unit_amount: FULL_AUDIT_PRICE_CENTS,
        },
        quantity: 1,
      },
    ],
    metadata: { scanId, email },
    success_url: `${baseUrl}/scan/${scanId}?payment=success`,
    cancel_url: `${baseUrl}/scan/${scanId}?payment=cancelled`,
  });

  await prisma.payment.create({
    data: {
      scanId,
      stripeSessionId: session.id,
      amount: FULL_AUDIT_PRICE_CENTS,
      customerEmail: email,
      status: "PENDING",
    },
  });

  return NextResponse.json({ url: session.url });
}
