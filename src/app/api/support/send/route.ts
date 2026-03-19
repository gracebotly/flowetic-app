import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Question",
  bug: "Bug Report",
  billing: "Billing Issue",
  feature: "Feature Request",
  other: "Other",
};

export async function POST(request: NextRequest) {
  try {
    // 0. Validate Resend API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error("[support/send] RESEND_API_KEY is not set");
      return json(500, { ok: false, error: "Email service is not configured. Please contact support directly." });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json(401, { ok: false, error: "Unauthorized" });

    // 2. Parse body
    const body = await request.json();
    const { category, description, attachments } = body as {
      category?: string;
      description?: string;
      attachments?: { fileName: string; signedUrl: string | null; storagePath: string }[];
    };

    if (!description?.trim()) {
      return json(400, { ok: false, error: "Description is required" });
    }

    const categoryLabel = CATEGORY_LABELS[category || "general"] || "General Question";
    const userEmail = user.email || "unknown";

    // 3. Build attachment section
    let attachmentHtml = "";
    if (attachments && attachments.length > 0) {
      const links = attachments
        .map((a) => `<li><a href="${a.signedUrl || "#"}">${a.fileName}</a></li>`)
        .join("\n");
      attachmentHtml = `
        <h3 style="margin-top:20px;font-size:14px;color:#64748b;">Attachments</h3>
        <ul style="font-size:14px;">${links}</ul>
        <p style="font-size:12px;color:#94a3b8;">Links expire in 7 days.</p>
      `;
    }

    // 4. Send to support team
    const { error: sendError } = await resend.emails.send({
      from: "Getflowetic Support <no-reply@getflowetic.com>",
      to: ["grace@getflowetic.com"],
      replyTo: userEmail,
      subject: `[${categoryLabel}] Support request from ${userEmail}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;">
          <h2 style="font-size:16px;color:#0f172a;margin-bottom:4px;">New support message</h2>
          <p style="font-size:13px;color:#64748b;margin-top:0;">From ${userEmail}</p>
          <table style="font-size:14px;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top;">Category</td>
              <td style="padding:4px 0;color:#0f172a;">${categoryLabel}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top;">User ID</td>
              <td style="padding:4px 0;color:#0f172a;font-family:monospace;font-size:12px;">${user.id}</td>
            </tr>
          </table>
          <h3 style="font-size:14px;color:#64748b;margin-bottom:8px;">Description</h3>
          <div style="font-size:14px;color:#0f172a;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;white-space:pre-wrap;">${description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          ${attachmentHtml}
        </div>
      `,
    });

    if (sendError) {
      console.error("[support/send] Resend error (support email):", sendError);
      return json(500, { ok: false, error: "Failed to send message. Please try again." });
    }

    // 5. Send confirmation email to the user
    try {
      await resend.emails.send({
        from: "Getflowetic <no-reply@getflowetic.com>",
        to: [userEmail],
        subject: "We received your support request",
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;">
            <h2 style="font-size:18px;color:#0f172a;margin-bottom:8px;">We received your message</h2>
            <p style="font-size:14px;color:#475569;line-height:1.6;">
              Thanks for reaching out. Our team has received your <strong>${categoryLabel.toLowerCase()}</strong> request
              and will get back to you within 24 hours.
            </p>
            <div style="margin:20px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;font-weight:600;">Your message:</p>
              <p style="font-size:14px;color:#0f172a;margin:0;white-space:pre-wrap;">${description.trim().slice(0, 500).replace(/</g, "&lt;").replace(/>/g, "&gt;")}${description.trim().length > 500 ? "..." : ""}</p>
            </div>
            <p style="font-size:13px;color:#94a3b8;margin-top:24px;">
              — The Getflowetic Team
            </p>
          </div>
        `,
      });
    } catch (confirmErr) {
      // Non-fatal: support email was sent successfully, confirmation is a nice-to-have
      console.warn("[support/send] User confirmation email failed:", confirmErr);
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error("[support/send] Error:", error);
    return json(500, { ok: false, error: "Something went wrong. Please try again." });
  }
}
