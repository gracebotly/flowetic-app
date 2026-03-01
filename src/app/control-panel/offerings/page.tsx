"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { Plus, BarChart3, Play, Layers, Link2, CreditCard } from "lucide-react";

type Offering = {
  id: string;
  name: string;
  surface_type: "analytics" | "runner" | "both";
  access_type: "magic_link" | "stripe_gate";
  platform_type: string | null;
  status: string;
  token: string | null;
  slug: string | null;
  pricing_type: string | null;
  price_cents: number | null;
  created_at: string;
  last_viewed_at: string | null;
};

const SURFACE_LABELS: Record<string, { label: string; icon: typeof BarChart3; color: string }> = {
  analytics: { label: "Analytics", icon: BarChart3, color: "text-blue-600 bg-blue-50" },
  runner: { label: "Run Workflow", icon: Play, color: "text-emerald-600 bg-emerald-50" },
  both: { label: "Analytics + Runner", icon: Layers, color: "text-violet-600 bg-violet-50" },
};

const ACCESS_LABELS: Record<string, { label: string; icon: typeof Link2; color: string }> = {
  magic_link: { label: "Magic Link", icon: Link2, color: "text-sky-600 bg-sky-50" },
  stripe_gate: { label: "Payment Gate", icon: CreditCard, color: "text-amber-600 bg-amber-50" },
};

export default function OfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Get tenant_id from memberships
      const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("user_id", session.user.id).single();

      if (!membership) return;

      const { data } = await supabase
        .from("offerings")
        .select("id, name, surface_type, access_type, platform_type, status, token, slug, pricing_type, price_cents, created_at, last_viewed_at")
        .eq("tenant_id", membership.tenant_id)
        .order("created_at", { ascending: false });

      setOfferings(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offerings</h1>
          <p className="mt-1 text-sm text-gray-500">Deliver analytics dashboards and workflow tools to your clients</p>
        </div>
        <Link
          href="/control-panel/offerings/create"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          New Offering
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && offerings.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <Layers className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">No offerings yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Create your first offering to deliver an analytics dashboard or workflow tool to a client.
          </p>
          <Link
            href="/control-panel/offerings/create"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create First Offering
          </Link>
        </div>
      )}

      {/* Offerings Table */}
      {!loading && offerings.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Name</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Surface</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Access</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Status</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => {
                const surface = SURFACE_LABELS[o.surface_type] || SURFACE_LABELS.analytics;
                const access = ACCESS_LABELS[o.access_type] || ACCESS_LABELS.magic_link;
                const SurfaceIcon = surface.icon;
                const AccessIcon = access.icon;

                return (
                  <tr key={o.id} className="border-b border-gray-50 transition hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/control-panel/offerings/${o.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {o.name}
                      </Link>
                      {o.platform_type && <span className="ml-2 text-xs text-gray-400 capitalize">{o.platform_type}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${surface.color}`}>
                        <SurfaceIcon className="h-3 w-3" />
                        {surface.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${access.color}`}>
                        <AccessIcon className="h-3 w-3" />
                        {access.label}
                      </span>
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
                    <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/control-panel/offerings/${o.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
