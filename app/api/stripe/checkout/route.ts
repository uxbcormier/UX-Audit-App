import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe, FULL_AUDIT_PRICE_CENTS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  scanId: z.string().min(1),
  email: z.string().email(),
});

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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Full UX Audit Report",
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
