"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSkeletonDescription } from "@/lib/portals/platformToSkeleton";
import { transformDataForSkeleton, type PortalEvent } from "@/lib/portals/transformData";
import { VoicePerformanceSkeleton } from "@/components/portals/skeletons/VoicePerformanceSkeleton";
import { WorkflowOperationsSkeleton } from "@/components/portals/skeletons/WorkflowOperationsSkeleton";
import { ROISummarySkeleton } from "@/components/portals/skeletons/ROISummarySkeleton";
import { CombinedOverviewSkeleton } from "@/components/portals/skeletons/CombinedOverviewSkeleton";
import { Copy, ExternalLink } from "lucide-react";

type Portal = {
  id: string;
  tenant_id: string;
  source_id: string;
  name: string;
  token: string;
  platform_type: string;
  skeleton_id: string;
  status: "active" | "paused" | "expired";
  client_id: string | null;
  created_at: string;
  last_viewed_at: string | null;
  expires_at: string | null;
};

type Source = { id: string; name: string; type: string };
type Tenant = { name: string; logo_url: string | null; primary_color: string; secondary_color: string };

const skeletonOptions = ["voice-performance", "workflow-operations", "roi-summary", "combined-overview"];

export default function PortalDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [previewEvents, setPreviewEvents] = useState<PortalEvent[]>([]);
  const [tab, setTab] = useState<"overview" | "preview" | "activity">("overview");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [skeletonId, setSkeletonId] = useState("workflow-operations");
  const [expires, setExpires] = useState("never");

  useEffect(() => {
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("user_id", authData.user.id).single();
      if (!membership) return;
      setTenantId(membership.tenant_id);

      const { data: portalData } = await supabase
        .from("client_portals")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", membership.tenant_id)
        .single();

      if (!portalData) {
        setLoading(false);
        return;
      }

      const [{ data: sourceData }, { data: tenantData }] = await Promise.all([
        supabase.from("sources").select("id, name, type").eq("id", portalData.source_id).eq("tenant_id", membership.tenant_id).single(),
        supabase.from("tenants").select("name, logo_url, primary_color, secondary_color").eq("id", membership.tenant_id).single(),
      ]);

      setPortal(portalData as Portal);
      setSource(sourceData as Source);
      setTenant(tenantData as Tenant);
      setName(portalData.name);
      setClientId(portalData.client_id ?? "");
      setSkeletonId(portalData.skeleton_id);
      setExpires(portalData.expires_at ? "custom" : "never");
      setLoading(false);
    })();
  }, [id, supabase]);

  useEffect(() => {
    if (!portal || tab !== "preview") return;
    void (async () => {
      const res = await fetch(`/api/portals/${portal.token}`);
      if (!res.ok) return;
      const json = await res.json();
      setPreviewEvents(json.events ?? []);
    })();
  }, [portal, tab]);

  const transformed = useMemo(() => {
    if (!portal) return null;
    return transformDataForSkeleton(previewEvents, skeletonId, portal.platform_type);
  }, [previewEvents, portal, skeletonId]);

  async function updateStatus(next: Portal["status"]) {
    if (!portal || !tenantId) return;
    const { error } = await supabase.from("client_portals").update({ status: next }).eq("id", portal.id).eq("tenant_id", tenantId);
    if (!error) setPortal({ ...portal, status: next });
  }

  async function saveChanges() {
    if (!portal || !tenantId) return;
    const payload = {
      name: name.trim(),
      client_id: clientId.trim() || null,
      skeleton_id: skeletonId,
      expires_at: expires === "never" ? null : portal.expires_at,
    };
    const { error } = await supabase.from("client_portals").update(payload).eq("id", portal.id).eq("tenant_id", tenantId);
    if (!error) setPortal({ ...portal, ...payload, name: payload.name });
  }

  async function deletePortal() {
    if (!portal || !tenantId) return;
    if (!confirm(`Delete portal \"${portal.name}\"?`)) return;
    const { error } = await supabase.from("client_portals").delete().eq("id", portal.id).eq("tenant_id", tenantId);
    if (!error) router.push("/control-panel/portals");
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading portal…</div>;
  if (!portal || !tenant) return <div className="p-6 text-sm text-red-600">Portal not found.</div>;

  const magicLink = `${typeof window !== "undefined" ? window.location.origin : ""}/client/${portal.token}`;
  const branding = { ...tenant, portalName: portal.name };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/control-panel/portals" className="text-sm text-blue-600 hover:underline">← Back to Portals</Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{portal.name}</h1>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(["overview", "preview", "activity"] as const).map((next) => (
          <button key={next} onClick={() => setTab(next)} className={`px-3 py-2 text-sm font-medium ${tab === next ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}>
            {next[0].toUpperCase() + next.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">Status
              <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={portal.status} onChange={(e) => void updateStatus(e.target.value as Portal["status"])}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <div className="text-sm text-gray-600">Platform: <span className="font-medium capitalize text-gray-900">{portal.platform_type}</span><br />Source: <span className="text-gray-900">{source?.name ?? "—"}</span></div>
            <div className="text-sm text-gray-600">Created: {new Date(portal.created_at).toLocaleString()}<br />Last Viewed: {portal.last_viewed_at ? new Date(portal.last_viewed_at).toLocaleString() : "—"}</div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-700 break-all">{magicLink}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(magicLink)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"><Copy className="h-4 w-4" />Copy Link</button>
              <a href={`/client/${portal.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700"><ExternalLink className="h-4 w-4" />Open in New Tab</a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">Portal Name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label>
            <label className="text-sm">Client<input value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label>
            <label className="text-sm">Skeleton
              <select value={skeletonId} onChange={(e) => setSkeletonId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
                {skeletonOptions.map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">{getSkeletonDescription(skeletonId)}</p>
            </label>
            <label className="text-sm">Expires
              <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={expires} onChange={(e) => setExpires(e.target.value)}>
                <option value="never">Never</option>
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={() => void saveChanges()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Save Changes</button>
            <button onClick={() => void deletePortal()} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">Delete Portal</button>
          </div>
        </div>
      ) : null}

      {tab === "preview" ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <a href={`/client/${portal.token}`} target="_blank" rel="noreferrer" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ExternalLink className="h-4 w-4" />Open in New Tab</a>
          <div className="rounded-lg border border-gray-200 p-4">
            {transformed ? (
              <>
                {skeletonId === "voice-performance" ? <VoicePerformanceSkeleton data={transformed} branding={branding} /> : null}
                {skeletonId === "workflow-operations" ? <WorkflowOperationsSkeleton data={transformed} branding={branding} /> : null}
                {skeletonId === "roi-summary" ? <ROISummarySkeleton data={transformed} branding={branding} /> : null}
                {skeletonId === "combined-overview" ? <CombinedOverviewSkeleton data={transformed} branding={branding} /> : null}
              </>
            ) : <p className="text-sm text-gray-500">Loading preview…</p>}
          </div>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-gray-900">Portal Activity</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>• Viewed — {portal.last_viewed_at ? new Date(portal.last_viewed_at).toLocaleString() : "Never viewed"}</li>
            <li>• Created — {new Date(portal.created_at).toLocaleString()}</li>
          </ul>
          <Link href="/control-panel/activity" className="mt-4 inline-block text-sm text-blue-600 hover:underline">View full Activity tab →</Link>
        </div>
      ) : null}
    </div>
  );
}
