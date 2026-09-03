import { Resend } from "resend";

let resendClient: Resend | undefined;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
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
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Your full UX Audit report is ready",
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
        <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #14b8a6; font-weight: 600; margin: 0 0 16px;">
          UX<span style="color: #14b8a6;">Audit</span>
        </p>
        <h1 style="font-size: 22px; margin: 0 0 16px;">Your full report is unlocked</h1>
        <p style="font-size: 15px; line-height: 1.5; color: #3f3f46; margin: 0 0 8px;">
          Thanks for your purchase. The complete conversion analysis for <strong>${scanUrl}</strong> is ready, including every insight, fix instructions, and your priority recommendations.
        </p>
        <a href="${reportUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #14b8a6; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">
          View your full report
        </a>
        <p style="font-size: 13px; color: #71717a; margin-top: 24px;">
          This link works any time — no login required.
        </p>
      </div>
    `,
  });
}
