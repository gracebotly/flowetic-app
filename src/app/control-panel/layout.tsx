import { createClient } from "@/lib/supabase/server";
import { ControlPanelSidebar } from "@/components/layout/cp-sidebar";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { EmailConfirmBanner } from "@/components/layout/EmailConfirmBanner";
import { BlockedPage } from "@/components/billing/BlockedPage";
import { SoftBlockBanner } from "@/components/billing/SoftBlockBanner";
import { getPlanLimits } from "@/lib/plans/constants";
import { getBlockStatus } from "@/lib/billing/getBlockStatus";
import { headers } from "next/headers";

// Pages accessible even when hard-blocked
const ALWAYS_ALLOWED = ["/control-panel/help"];

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

  let plan = "Agency";
  let tenantName = "";
  let tenantLogoUrl: string | null = null;
  let tenantColor = "#059669";
  let blockInfo = getBlockStatus({
    plan_status: "active",
    trial_ends_at: null,
    has_card_on_file: false,
    plan_updated_at: null,
  });

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (membership) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select(
          "plan, plan_status, trial_ends_at, has_card_on_file, has_ever_paid, plan_updated_at, name, logo_url, primary_color"
        )
        .eq("id", membership.tenant_id)
        .single();

      if (tenant) {
        tenantName = tenant.name || "";
        tenantLogoUrl = tenant.logo_url || null;
        tenantColor = tenant.primary_color || "#059669";

        const limits = getPlanLimits(tenant.plan);
        const trialExpired =
          tenant.plan_status === "trialing" &&
          !!tenant.trial_ends_at &&
          new Date(tenant.trial_ends_at) < new Date();

        if (trialExpired && !tenant.has_card_on_file) {
          plan = `${limits.label} (Trial Expired)`;
        } else if (
          tenant.plan_status === "trialing" &&
          !tenant.trial_ends_at &&
          !tenant.has_card_on_file
        ) {
          // Pay-now user who never completed checkout
          plan = `${limits.label} (Payment Required)`;
        } else if (tenant.plan_status === "trialing") {
          plan = `${limits.label} (Trial)`;
        } else if (tenant.plan_status === "past_due") {
          plan = `${limits.label} (Past Due)`;
        } else if (tenant.plan_status === "cancelled") {
          plan = `${limits.label} (Cancelled)`;
        } else {
          plan = limits.label;
        }

        blockInfo = getBlockStatus(tenant);
      }
    }
  }

  // Determine current path
  const headersList = await headers();
  const pathname =
    headersList.get("x-next-pathname") ||
    headersList.get("x-invoke-path") ||
    "";
  const isAllowedPage =
    !!pathname && ALWAYS_ALLOWED.some((p) => pathname.startsWith(p));

  // Determine what to render in <main>
  let mainContent: React.ReactNode;

  if (blockInfo.level === "hard_block" && !isAllowedPage) {
    // Hard block: full-page takeover
    mainContent = <BlockedPage reason={blockInfo.reason!} />;
  } else {
    // Active or soft-blocked: show normal content
    mainContent = children;
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
        <EmailConfirmBanner />
        {/* Show soft block banner OR trial banner, not both */}
        {blockInfo.level === "soft_block" && blockInfo.reason ? (
          <SoftBlockBanner
            reason={blockInfo.reason as "cancelled" | "payment_failed"}
            daysRemaining={blockInfo.daysRemaining ?? 0}
          />
        ) : (
          <TrialBanner />
        )}
        <main className="min-h-screen flex-1 bg-[hsl(var(--main-bg))]">
          {mainContent}
        </main>
      </div>
    </div>
  );
}
