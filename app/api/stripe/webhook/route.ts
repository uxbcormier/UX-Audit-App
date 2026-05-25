import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const scanId = session.metadata?.scanId;

    if (scanId) {
      await prisma.payment.update({
        where: { stripeSessionId: session.id },
        data: {
          status: "PAID",
          stripePaymentId: session.payment_intent as string,
        },
      });
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    await prisma.payment
      .update({
        where: { stripeSessionId: session.id },
        data: { status: "FAILED" },
      })
      .catch(() => {});
  }

  return NextResponse.json({ received: true });
}
