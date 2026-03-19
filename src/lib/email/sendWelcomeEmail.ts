import { Resend } from "resend";

interface WelcomeEmailParams {
  to: string;
  customerName?: string | null;
  portalName: string;
  dashboardUrl: string;
  agencyName: string;
  agencyLogoUrl?: string | null;
  primaryColor?: string;
}

/**
 * Send a branded welcome email to a client after successful subscription.
 * Sent under the agency's name (white-label) — Getflowetic is never mentioned.
 *
 * Non-fatal: logs errors but never throws. Payment flow must not break
 * because of an email delivery failure.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendWelcomeEmail] RESEND_API_KEY not set — skipping");
    return;
  }

  const resend = new Resend(apiKey);
  const {
    to,
    customerName,
    portalName,
    dashboardUrl,
    agencyName,
    agencyLogoUrl,
    primaryColor = "#374151",
  } = params;

  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  const logoBlock = agencyLogoUrl
    ? `<img src="${agencyLogoUrl}" alt="${agencyName}" style="height:32px;width:auto;margin-bottom:16px;" />`
    : "";

  try {
    await resend.emails.send({
      from: `${agencyName} <no-reply@getflowetic.com>`,
      to: [to],
      subject: `Your ${portalName} dashboard is ready`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 0;">
          ${logoBlock}
          <h1 style="font-size:20px;font-weight:600;color:#0f172a;margin:0 0 8px 0;">
            Welcome to ${portalName}
          </h1>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px 0;">
            ${greeting} Your subscription is confirmed and your dashboard is ready.
            Bookmark the link below so you can access it anytime.
          </p>
          <a href="${dashboardUrl}"
             style="display:inline-block;background-color:${primaryColor};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Open your dashboard
          </a>
          <p style="font-size:13px;color:#94a3b8;margin-top:32px;line-height:1.5;">
            If the button above doesn't work, copy and paste this URL into your browser:<br/>
            <a href="${dashboardUrl}" style="color:${primaryColor};word-break:break-all;">${dashboardUrl}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px 0;" />
          <p style="font-size:12px;color:#94a3b8;margin:0;">
            Sent by ${agencyName}
          </p>
        </div>
      `,
    });
    console.log(`[sendWelcomeEmail] Sent to ${to} for portal "${portalName}"`);
  } catch (err) {
    // Non-fatal — never let email failure break the webhook
    console.error("[sendWelcomeEmail] Failed:", err);
  }
}
