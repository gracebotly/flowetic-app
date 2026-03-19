import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { withApiHandler } from "@/lib/api/withApiHandler";

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

export const POST = withApiHandler(async function POST(req: Request) {
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

  // ── Step 1: Check if auth user exists via the check_email_registered RPC ──
  const { data: authExists, error: rpcError } = await supabaseAdmin
    .rpc("check_email_registered", { p_email: email })
    .single();

  if (rpcError || authExists !== true) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "No account found with this email. Please sign up first.",
      },
      { status: 404 }
    );
  }

  // ── Step 2: Check they have an active membership (not orphaned) ──
  // Look up user ID from auth.users via admin API
  const { data: authUserList } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const matchedUser = authUserList?.users?.find(
    (u) => u.email?.toLowerCase() === email
  );

  if (!matchedUser) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "No account found with this email. Please sign up first.",
      },
      { status: 404 }
    );
  }

  // ── Step 3: Check membership exists ──
  const { data: memberships } = await supabaseAdmin
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", matchedUser.id)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "No account found with this email. Please sign up first.",
      },
      { status: 404 }
    );
  }

  // ── Step 4: Check tenant is not soft-deleted ──
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("deleted_at, scheduled_purge_at")
    .eq("id", memberships[0].tenant_id)
    .single();

  if (tenant?.deleted_at) {
    const purgeDate = tenant.scheduled_purge_at
      ? new Date(tenant.scheduled_purge_at).toLocaleDateString()
      : "soon";
    return NextResponse.json(
      {
        ok: false,
        code: "workspace_deleted",
        message: `This workspace was deleted and is scheduled for permanent removal on ${purgeDate}. Contact support if you need to restore it.`,
      },
      { status: 403 }
    );
  }

  // ── Step 5: Send the magic link ──
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl(req)}/auth/callback?intent=signin`,
    },
  });

  if (error) {
    console.error("[send-signin-link]", error.message);

    if (error.message.toLowerCase().includes("signups not allowed")) {
      return NextResponse.json(
        { ok: false, code: "not_found", message: "No account found with this email. Please sign up first." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: false, code: "send_failed", message: "Failed to send sign-in link. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
});
