"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Building2,
  Palette,
  CreditCard,
  Users,
  AlertTriangle,
} from "lucide-react";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";
import { BrandingTab } from "@/components/settings/BrandingTab";

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

  // Sync tab to URL query param
  const handleTabChange = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="Manage your workspace, branding, team, and billing."
      />

      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* Tab navigation — matches offerings/[id] pattern */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition ${
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

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === "workspace" && <WorkspaceTab />}
          {activeTab === "branding" && <BrandingTab />}
          {activeTab === "billing" && (
            <PlaceholderTab
              title="Billing & Stripe Connect"
              description="Connect your Stripe account to collect payments from your products. Coming in a future update."
            />
          )}
          {activeTab === "team" && (
            <PlaceholderTab
              title="Team Members"
              description="Invite team members and manage roles. Coming in Phase 3."
            />
          )}
          {activeTab === "danger" && (
            <PlaceholderTab
              title="Danger Zone"
              description="Export data and delete workspace. Coming in Phase 4."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Temporary placeholder for Phase 3/4 tabs
function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}
