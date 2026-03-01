"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Copy, ExternalLink, BarChart3, Play, Layers, Link2, CreditCard } from "lucide-react";

type Offering = {
  id: string;
  name: string;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  skeleton_id: string | null;
  status: string;
  token: string | null;
  slug: string | null;
  pricing_type: string | null;
  price_cents: number | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  last_viewed_at: string | null;
};

const SURFACE_META: Record<string, { label: string; icon: typeof BarChart3 }> = {
  analytics: { label: "Live Analytics Dashboard", icon: BarChart3 },
  runner: { label: "Workflow Runner", icon: Play },
  both: { label: "Analytics + Workflow Runner", icon: Layers },
};

const ACCESS_META: Record<string, { label: string; icon: typeof Link2 }> = {
  magic_link: { label: "Free Magic Link", icon: Link2 },
  stripe_gate: { label: "Payment Gate", icon: CreditCard },
};

const SKELETON_NAMES: Record<string, string> = {
  "voice-performance": "Voice Performance Dashboard",
  "workflow-operations": "Workflow Operations Dashboard",
  "roi-summary": "ROI Summary Dashboard",
  "combined-overview": "Combined Overview Dashboard",
};

export default function OfferingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [offering, setOffering] = useState<Offering | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("user_id", session.user.id).single();

      if (!membership) return;

      const { data } = await supabase.from("offerings").select("*").eq("id", id).eq("tenant_id", membership.tenant_id).single();

      setOffering(data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!offering) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-gray-500">Offering not found.</p>
        <Link href="/control-panel/offerings" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
          ← Back to Offerings
        </Link>
      </div>
    );
  }

  const surface = SURFACE_META[offering.surface_type] || SURFACE_META.analytics;
  const access = ACCESS_META[offering.access_type] || ACCESS_META.magic_link;
  const SurfaceIcon = surface.icon;
  const AccessIcon = access.icon;

  // Build client-facing URL
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const clientUrl = offering.access_type === "magic_link" && offering.token ? `${baseUrl}/client/${offering.token}` : offering.slug ? `${baseUrl}/products/${offering.slug}` : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Back link */}
      <Link href="/control-panel/offerings" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Offerings
      </Link>

      {/* Title */}
      <h1 className="mt-4 text-2xl font-bold text-gray-900">{offering.name}</h1>

      {/* Dimension badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <SurfaceIcon className="h-3.5 w-3.5" />
          {surface.label}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          <AccessIcon className="h-3.5 w-3.5" />
          {access.label}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            offering.status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : offering.status === "draft"
                ? "bg-gray-100 text-gray-600"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              offering.status === "active" ? "bg-emerald-500" : offering.status === "draft" ? "bg-gray-400" : "bg-amber-500"
            }`}
          />
          {offering.status.charAt(0).toUpperCase() + offering.status.slice(1)}
        </span>
      </div>

      {/* Info grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Platform & Dashboard type */}
        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Platform</p>
          <p className="mt-1 text-sm font-semibold capitalize text-gray-900">{offering.platform_type || "—"}</p>
          {offering.skeleton_id && (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">Dashboard Type</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{SKELETON_NAMES[offering.skeleton_id] || offering.skeleton_id}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Auto-configured
              </span>
            </>
          )}
        </div>

        {/* Timestamps */}
        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Created</p>
          <p className="mt-1 text-sm text-gray-700">{new Date(offering.created_at).toLocaleString()}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">Last Viewed</p>
          <p className="mt-1 text-sm text-gray-700">{offering.last_viewed_at ? new Date(offering.last_viewed_at).toLocaleString() : "—"}</p>
          {offering.expires_at && (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">Expires</p>
              <p className="mt-1 text-sm text-gray-700">{new Date(offering.expires_at).toLocaleString()}</p>
            </>
          )}
        </div>
      </div>

      {/* Client URL */}
      {clientUrl && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">Client Link</p>
          <p className="break-all text-sm text-gray-700">{clientUrl}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(clientUrl)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </button>
            <a
              href={clientUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
