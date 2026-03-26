// src/app/api/auth/ensure-tenant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { TRIAL_DAYS_WITHOUT_CARD } from "@/lib/plans/constants";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, reason: "not_authenticated" }, { status: 401 });
  }

  // Check if user already has a membership
  const { data: memberships } = await supabaseAdmin
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    // Check if their tenant is soft-deleted
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("deleted_at")
      .eq("id", memberships[0].tenant_id)
      .single();

    if (tenant?.deleted_at) {
      // User has a membership but their workspace is soft-deleted.
      // Do NOT create a new tenant — reject them.
      return NextResponse.json(
        { ok: false, reason: "workspace_deleted" },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, reason: "already_exists" });
  }

  // Parse optional body params
  let plan = "agency";
  let skipTrial = false;
  let intent = "signup";
  try {
    const body = await request.json();
    if (body?.plan === "scale" || body?.plan === "agency") plan = body.plan;
    if (body?.skipTrial === true) skipTrial = true;
    if (body?.intent === "signin") intent = "signin";
  } catch {
    // No body or invalid JSON — use defaults
  }

  // CRITICAL: Do NOT auto-create tenants for sign-in intent.
  // If a user is signing in and has no membership, they are an orphan
  // (e.g. their workspace was hard-deleted before soft-delete was added).
  // Reject them instead of silently re-provisioning.
  if (intent === "signin") {
    return NextResponse.json(
      { ok: false, reason: "no_workspace" },
      { status: 403 }
    );
  }

  // Create tenant + membership (only for signup intent)
  // Derive workspace name from email domain when possible.
  // Generic providers get the email prefix instead.
  const genericDomains = new Set([
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
    'yahoo.com', 'yahoo.co.uk', 'aol.com', 'icloud.com', 'me.com',
    'mail.com', 'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com',
  ]);

  let workspaceName = "My Workspace";
  if (user.email) {
    const [localPart, domain] = user.email.split("@");
    if (domain && !genericDomains.has(domain.toLowerCase())) {
      // Business domain — use domain name without TLD, title-cased
      // e.g. grace@apexai.com → "Apexai"
      const domainName = domain.split(".")[0];
      workspaceName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
    } else if (localPart) {
      // Generic provider — use email prefix
      workspaceName = `${localPart}'s Workspace`;
    }
  }

  const { data: tenant, error: tErr } = await supabaseAdmin
    .from("tenants")
    .insert({
      name: workspaceName,
      plan,
      plan_status: "trialing",
      has_card_on_file: false,
      trial_ends_at: skipTrial
        ? null
        : new Date(
            Date.now() + TRIAL_DAYS_WITHOUT_CARD * 24 * 60 * 60 * 1000
          ).toISOString(),
    })
    .select()
    .single();

  if (tErr || !tenant) {
    console.error("[ensure-tenant] Failed to create tenant", tErr);
    return NextResponse.json(
      { ok: false, reason: "tenant_creation_failed" },
      { status: 500 }
    );
  }

  const { error: mErr } = await supabaseAdmin.from("memberships").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "admin",
  });

  if (mErr) {
    console.error("[ensure-tenant] Failed to create membership", mErr);
    return NextResponse.json(
      { ok: false, reason: "membership_creation_failed" },
      { status: 500 }
    );
  }

  console.log(`[ensure-tenant] Created tenant ${tenant.id} (plan=${plan}, skipTrial=${skipTrial}) for user ${user.id}`);
  return NextResponse.json({ ok: true, reason: "created", tenantId: tenant.id });
}
