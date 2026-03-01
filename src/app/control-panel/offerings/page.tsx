"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Layers } from "lucide-react";
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
        .from("offerings")
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
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offerings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Deliver analytics dashboards and workflow tools to your clients
          </p>
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
            Create your first offering to deliver an analytics dashboard or workflow tool to a
            client.
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
              {offerings.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-gray-50 transition hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/control-panel/offerings/${o.id}`}
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
                      href={`/control-panel/offerings/${o.id}`}
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
