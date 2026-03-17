import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMAIL_RE =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

/** Common domain typos → corrections */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
};

function siteUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && env.startsWith("http")) return env;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  const body: { email?: unknown } = await req.json().catch(() => ({}));
  const email = (body.email ?? "").toString().trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, code: "invalid_format", message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const domain = email.split("@")[1];
  const suggestion = DOMAIN_TYPOS[domain];
  if (suggestion) {
    const corrected = email.replace(`@${domain}`, `@${suggestion}`);
    return NextResponse.json(
      {
        ok: false,
        code: "typo_detected",
        message: `Did you mean ${corrected}?`,
        suggested: corrected,
      },
      { status: 400 }
    );
  }

  const { data: userCheck, error: checkError } = await supabaseAdmin
    .from("users_view")
    .select("id")
    .eq("email", email)
    .limit(1);

  let userExists = false;

  if (!checkError && userCheck && userCheck.length > 0) {
    userExists = true;
  } else {
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "check_email_registered",
      { p_email: email }
    );
    if (!rpcError && rpcResult === true) {
      userExists = true;
    }
  }

  if (!userExists) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "No account found with this email. Please sign up first.",
      },
      { status: 404 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl(req)}/auth/callback?intent=signin`,
  });

  if (error) {
    console.error("[send-signin-link]", error.message);
    return NextResponse.json(
      { ok: false, code: "send_failed", message: "Failed to send sign-in link. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
