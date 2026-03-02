"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Building2,
  Palette,
  CreditCard,
  Users,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";
import { BrandingTab } from "@/components/settings/BrandingTab";
import { TeamTab } from "@/components/settings/TeamTab";
import { BillingTab } from "@/components/settings/BillingTab";
import { DangerTab } from "@/components/settings/DangerTab";
import { RoleGate } from "@/components/settings/RoleGate";
import { getPermissions } from "@/lib/settings/rbac";

// ── Tab definitions ─────────────────────────────────────────
type TabKey = "workspace" | "branding" | "billing" | "team" | "danger";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "workspace", label: "Workspace", icon: Building2 },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "team", label: "Team", icon: Users },
  { key: "danger", label: "Danger Zone", icon: AlertTriangle },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as TabKey | null;
  const activeTab =
    tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "workspace";

  // ── Fetch current user's role ─────────────────────────────
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/role");
        const json = await res.json();
        if (active && json.ok) {
          setRole(json.role);
        }
      } catch {
        // Fallback: assume viewer (safest)
        if (active) setRole("viewer");
      }
      if (active) setRoleLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const perms = getPermissions(role ?? "viewer");

  // Sync tab to URL query param
  const handleTabChange = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // ── Role loading state ────────────────────────────────────
  if (roleLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader
          title="Settings"
          subtitle="Manage your workspace, branding, team, and billing."
        />
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="Manage your workspace, branding, team, and billing."
      />

      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* Tab navigation — matches offerings/[id] pattern */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content — wrapped in RoleGate where needed */}
        <div className="mt-6">
          {activeTab === "workspace" && (
            <RoleGate allowed={perms.canEditWorkspace}>
              <WorkspaceTab />
            </RoleGate>
          )}
          {activeTab === "branding" && (
            <RoleGate allowed={perms.canEditBranding}>
              <BrandingTab />
            </RoleGate>
          )}
          {activeTab === "billing" && (
            <RoleGate allowed={perms.canManageBilling}>
              <BillingTab />
            </RoleGate>
          )}
          {activeTab === "team" && (
            <RoleGate allowed={perms.canManageTeam}>
              <TeamTab />
            </RoleGate>
          )}
          {activeTab === "danger" && (
            <RoleGate allowed={perms.canDeleteWorkspace}>
              <DangerTab />
            </RoleGate>
          )}
        </div>
      </div>
    </div>
  );
}
