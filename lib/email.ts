import { Resend } from "resend";
import { trimmedEnv } from "./env";

let resendClient: Resend | undefined;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(trimmedEnv("RESEND_API_KEY"));
  }
  return resendClient;
}

export async function sendReportReadyEmail({
  to,
  scanUrl,
  reportUrl,
}: {
  to: string;
  scanUrl: string;
  reportUrl: string;
}) {
  await getResend().emails.send({
    from: trimmedEnv("EMAIL_FROM")!,
    to,
    subject: "Your full Grafter audit is ready",
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #F3F0E9; color: #171714;">
        <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #171714; font-weight: 600; margin: 0 0 16px;">
          GRAFTER
        </p>
        <h1 style="font-size: 22px; margin: 0 0 16px; font-weight: 600;">Your full audit is unlocked</h1>
        <p style="font-size: 15px; line-height: 1.5; color: #171714; margin: 0 0 8px;">
          Thanks for your purchase. The complete evidence-led audit for <strong>${scanUrl}</strong> is ready — every verified finding, the evidence behind it, and what to fix first.
        </p>
        <a href="${reportUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #315A46; color: #F3F0E9; text-decoration: none; font-weight: 600; font-size: 14px;">
          View your full report
        </a>
        <p style="font-size: 13px; color: #716B5F; margin-top: 24px;">
          This link works any time — no login required.
        </p>
      </div>
    `,
  });
}
