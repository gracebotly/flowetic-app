// src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function siteUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && env.startsWith("http")) return env;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({} as any));

  const name = (body?.name ?? "").toString();
  const email = (body?.email ?? "").toString();
  const password = (body?.password ?? "").toString();

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: "Email and password are required." }, { status: 400 });
  }

  const redirectTo = `${siteUrl(req)}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    // This will show up in Vercel → Logs so you can see the real SMTP/provider error
    console.error("[auth/signup] Supabase error", {
      message: error.message,
      name: error.name,
      status: (error as any)?.status,
      redirectTo,
    });

    // Helpful hints for common misconfigurations
    let hint = "";
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("email") && (msg.includes("send") || msg.includes("smtp") || msg.includes("transport"))) {
      hint =
        "Check Supabase Auth → Email (SMTP): host smtp.resend.com, port 587 (TLS) or 465 (SSL), username 'resend', password = Resend API key, From email = no-reply@getflowetic.com (verified domain).";
    } else if (msg.includes("redirect") || msg.includes("url")) {
      hint = `Ensure Site URL is ${siteUrl(req)} and Additional Redirect URLs includes ${redirectTo} in Supabase Auth → URL Configuration.`;
    }

    return NextResponse.json({ ok: false, message: error.message, hint }, { status: 400 });
  }

  return NextResponse.json({ ok: true, hasSession: Boolean(data?.session) });
}