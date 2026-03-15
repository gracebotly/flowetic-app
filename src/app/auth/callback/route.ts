import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/control-panel/connections";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  // Ensure tenant + membership exist
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberships, error: mErr } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1);

    if (!mErr && (!memberships || memberships.length === 0)) {
      const workspaceName = user.email ? `${user.email.split("@")[0]}'s Workspace` : "My Workspace";

      // Use service client to bypass RLS for initial tenant + membership creation.
      // The memberships_insert_admin policy requires an existing membership row,
      // which creates a chicken-and-egg block for brand new users.
      const serviceClient = createServiceClient();

      const { data: tenant, error: tErr } = await serviceClient
        .from("tenants")
        .insert({
          name: workspaceName,
          plan: "agency",
          plan_status: "trialing",
          has_card_on_file: false,
          trial_ends_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select()
        .single();

      if (!tErr && tenant) {
        await serviceClient.from("memberships").insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role: "admin",
        });
      }
    }
  }

  const redirectUrl = new URL(next, request.url);
  return NextResponse.redirect(redirectUrl);
}
