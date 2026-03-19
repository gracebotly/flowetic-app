// src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

/**
 * Basic email format check — same regex used on the frontend.
 * Rejects obvious junk like "asdf", "a@b", "test@.com", etc.
 */
const EMAIL_RE =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

function siteUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && env.startsWith("http")) return env;
  return new URL(req.url).origin;
}
export const POST = withApiHandler(async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const name = (body?.name ?? "").toString().trim();
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const password = (body?.password ?? "").toString();
  const trialParam = (body?.trial ?? "7").toString();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Email and password are required." },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  // CRITICAL: include intent=signup so /auth/callback creates the tenant
  const redirectTo = `${siteUrl(req)}/auth/callback?intent=signup&trial=${trialParam}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error("[auth/signup] Supabase error", {
      message: error.message,
      name: error.name,
      status: typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : undefined,
      redirectTo,
    });

    let hint = "";
    const msg = (error.message || "").toLowerCase();
    if (
      msg.includes("email") &&
      (msg.includes("send") || msg.includes("smtp") || msg.includes("transport"))
    ) {
      hint =
        "Check Supabase Auth → Email (SMTP): host smtp.resend.com, port 587 (TLS) or 465 (SSL), username 'resend', password = Resend API key, From email = no-reply@getflowetic.com (verified domain).";
    } else if (msg.includes("redirect") || msg.includes("url")) {
      hint = `Ensure Site URL is ${siteUrl(req)} and Additional Redirect URLs includes ${redirectTo} in Supabase Auth → URL Configuration.`;
    }

    return NextResponse.json(
      { ok: false, message: error.message, hint },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, hasSession: Boolean(data?.session) });
});
