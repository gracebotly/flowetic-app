import { createClient } from "@/lib/supabase/server";
import { ControlPanelSidebar } from "@/components/layout/cp-sidebar";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { getPlanLimits } from "@/lib/plans/constants";

export default async function ControlPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "you@workspace.com";

  // Resolve actual plan + tenant branding from tenant
  let plan = "Agency";
  let tenantName = "";
  let tenantLogoUrl: string | null = null;
  let tenantColor = "#3B82F6";

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (membership) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("plan, plan_status, trial_ends_at, name, logo_url, primary_color")
        .eq("id", membership.tenant_id)
        .single();

      if (tenant) {
        tenantName = tenant.name || "";
        tenantLogoUrl = tenant.logo_url || null;
        tenantColor = tenant.primary_color || "#3B82F6";

        const limits = getPlanLimits(tenant.plan);
        const trialExpired =
          tenant.plan_status === "trialing" &&
          !!tenant.trial_ends_at &&
          new Date(tenant.trial_ends_at) < new Date();

        if (trialExpired) {
          plan = `${limits.label} (Trial Expired)`;
        } else if (tenant.plan_status === "trialing") {
          plan = `${limits.label} (Trial)`;
        } else if (tenant.plan_status === "past_due") {
          plan = `${limits.label} (Past Due)`;
        } else {
          plan = limits.label;
        }
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      <ControlPanelSidebar
        userEmail={email}
        plan={plan}
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        tenantColor={tenantColor}
      />
      <div className="flex flex-1 flex-col">
        <TrialBanner />
        <main className="flex-1 bg-[hsl(var(--main-bg))] min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
