// src/app/auth/confirm/route.ts
//
// Handles email links that use the token_hash format:
//   /auth/confirm?token_hash=xxx&type=recovery&next=/control-panel/connections
//
// This is the recommended Supabase pattern for:
//   - Password recovery (type=recovery)
//   - Email confirmation (type=email)
//   - Magic links (type=magiclink)
//
// After verifying the token, the user has an active session and is
// redirected to the `next` param (or /control-panel/connections).
//
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { TRIAL_DAYS_WITHOUT_CARD } from "@/lib/plans/constants";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/control-panel/connections";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/auth/auth-code-error", request.url)
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("[auth/confirm] verifyOtp failed:", error.message);
    return NextResponse.redirect(
      new URL(`/auth/auth-code-error?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  // User is now authenticated — check if they need a tenant
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberships } = await supabaseAdmin
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1);

    const isNewUser = !memberships || memberships.length === 0;

    if (isNewUser && type === "email") {
      // This is a new signup confirmation — create tenant + membership
      // Derive workspace name from email domain when possible.
      const genericDomains = new Set([
        'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
        'yahoo.com', 'yahoo.co.uk', 'aol.com', 'icloud.com', 'me.com',
        'mail.com', 'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com',
      ]);

      let workspaceName = "My Workspace";
      if (user.email) {
        const [localPart, domain] = user.email.split("@");
        if (domain && !genericDomains.has(domain.toLowerCase())) {
          const domainName = domain.split("@")[0].split(".")[0];
          workspaceName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
        } else if (localPart) {
          workspaceName = `${localPart}'s Workspace`;
        }
      }

      const { data: tenant, error: tErr } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: workspaceName,
          plan: "agency",
          plan_status: "trialing",
          has_card_on_file: false,
          trial_ends_at: new Date(
            Date.now() + TRIAL_DAYS_WITHOUT_CARD * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select()
        .single();

      if (!tErr && tenant) {
        await supabaseAdmin.from("memberships").insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role: "admin",
        });
        console.log(
          `[auth/confirm] Created tenant ${tenant.id} for new user ${user.id}`
        );
      }
    }
    // For type=recovery or type=magiclink, the user already has a tenant.
    // They just get signed in and redirected.
  }

  // Redirect to the intended destination
  const destination = next.startsWith("/") ? next : "/control-panel/connections";
  return NextResponse.redirect(new URL(destination, request.url));
}
