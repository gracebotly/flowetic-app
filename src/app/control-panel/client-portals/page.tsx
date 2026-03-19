"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Layers, ArrowUpRight, Trash2, PenLine } from "lucide-react";
import { SurfaceBadge } from "@/components/offerings/SurfaceBadge";
import { AccessBadge } from "@/components/offerings/AccessBadge";

type Offering = {
  id: string;
  name: string;
  description: string | null;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  status: string;
  created_at: string;
  last_viewed_at: string | null;
};

type WizardDraft = {
  id: string;
  draft_name: string;
  platform_type: string | null;
  surface_type: string;
  current_step: number;
  updated_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function OfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<{ current: number; limit: number } | null>(null);
  const [wizardDraft, setWizardDraft] = useState<WizardDraft | null>(null);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [emailBlocked, setEmailBlocked] = useState(false);
  const atLimit = usageData ? usageData.current >= usageData.limit : false;
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: membership } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", session.user.id)
        .single();

      if (!membership) return;

      const { data } = await supabase
        .from("client_portals")
        .select(
          "id, name, description, surface_type, access_type, platform_type, status, created_at, last_viewed_at"
        )
        .eq("tenant_id", membership.tenant_id)
        .neq("status", "archived")
        .order("created_at", { ascending: false });

      setOfferings(data || []);
      setLoading(false);
    }
    load();

    // Load wizard draft
    fetch("/api/wizard-drafts")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.draft) {
          setWizardDraft({
            id: json.draft.id,
            draft_name: json.draft.draft_name,
            platform_type: json.draft.platform_type,
            surface_type: json.draft.surface_type,
            current_step: json.draft.current_step,
            updated_at: json.draft.updated_at,
          });
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/settings/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.usage?.portals) {
          setUsageData({
            current: data.usage.portals.current,
            limit: data.usage.portals.limit === Infinity ? 999 : data.usage.portals.limit,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Portals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Deliver analytics dashboards and workflow tools to your clients
          </p>
        </div>
        {atLimit ? (
          <Link
            href="/control-panel/settings?tab=billing"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
          >
            <ArrowUpRight className="h-4 w-4" />
            Upgrade Plan
          </Link>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={async () => {
                try {
                  const supabase = (await import("@/lib/supabase/client")).createClient();
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (user && !user.email_confirmed_at) {
                    setEmailBlocked(true);
                    setTimeout(() => setEmailBlocked(false), 3000);
                    return;
                  }
                  router.push("/control-panel/client-portals/create");
                } catch (e) {
                  console.error("[client-portals] new portal check failed:", e);
                  router.push("/control-panel/client-portals/create");
                }
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              New Portal
            </button>
            {emailBlocked && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-blue-200 bg-white p-3 shadow-lg">
                <p className="text-xs text-slate-900">
                  Verify your email before creating a portal.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Check your inbox for a confirmation link.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Usage indicator */}
      {usageData && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {usageData.current} / {usageData.limit === 999 ? "∞" : usageData.limit} portals used
              </span>
              {atLimit && (
                <span className="font-medium text-amber-600">Limit reached</span>
              )}
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${
                  atLimit
                    ? "bg-amber-500"
                    : usageData.current / usageData.limit >= 0.8
                      ? "bg-amber-400"
                      : "bg-blue-500"
                }`}
                style={{
                  width: `${Math.min((usageData.current / (usageData.limit === 999 ? Math.max(usageData.current, 1) : usageData.limit)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && offerings.length === 0 && !wizardDraft && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <Layers className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No client portals yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Create your first client portal to deliver a branded dashboard or sellable product to your client.
          </p>
          <Link
            href="/control-panel/client-portals/create"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create First Portal
          </Link>
        </div>
      )}

      {/* Offerings Table */}
      {!loading && (offerings.length > 0 || wizardDraft) && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Type
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Last Viewed
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {/* Wizard draft row */}
              {wizardDraft && (
                <tr className="border-b border-gray-50 bg-gray-50/30">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => router.push("/control-panel/client-portals/create?resume=supabase")}
                      className="cursor-pointer font-medium text-slate-900 transition-colors duration-200 hover:text-blue-600"
                    >
                      {wizardDraft.draft_name || "Untitled draft"}
                    </button>
                    {wizardDraft.platform_type && (
                      <span className="mt-0.5 inline-block text-xs capitalize text-slate-600">
                        {wizardDraft.platform_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SurfaceBadge surfaceType={wizardDraft.surface_type} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      Draft — Step {wizardDraft.current_step}/4
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {timeAgo(wizardDraft.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => router.push("/control-panel/client-portals/create?resume=supabase")}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
                      >
                        <PenLine className="h-3 w-3" />
                        Resume
                      </button>
                      <button
                        type="button"
                        disabled={discardingDraft}
                        onClick={async () => {
                          setDiscardingDraft(true);
                          try {
                            await fetch("/api/wizard-drafts", { method: "DELETE" });
                            setWizardDraft(null);
                          } catch {}
                          setDiscardingDraft(false);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 transition-colors duration-200 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                        Discard
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {offerings.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-gray-50 transition hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/control-panel/client-portals/${o.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {o.name}
                    </Link>
                    {o.description && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-gray-400">
                        {o.description}
                      </p>
                    )}
                    {o.platform_type && (
                      <span className="mt-0.5 inline-block text-xs capitalize text-gray-400">
                        {o.platform_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <SurfaceBadge surfaceType={o.surface_type} />
                      <AccessBadge accessType={o.access_type} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        o.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : o.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : o.status === "paused"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          o.status === "active"
                            ? "bg-emerald-500"
                            : o.status === "draft"
                              ? "bg-gray-400"
                              : o.status === "paused"
                                ? "bg-amber-500"
                                : "bg-red-500"
                        }`}
                      />
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {o.last_viewed_at ? timeAgo(o.last_viewed_at) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/control-panel/client-portals/${o.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
