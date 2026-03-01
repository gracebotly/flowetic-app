"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ActivepiecesLogo, MakeLogo, N8nLogo, RetellLogo, VapiLogo } from "@/components/connections/platform-icons";
import { Copy, Eye, MoreVertical, Pause, Play, Plus, Search, Trash2 } from "lucide-react";

type PortalRow = {
  id: string;
  name: string;
  platform_type: string;
  skeleton_id: string;
  status: "active" | "paused" | "expired";
  client_id: string | null;
  token: string;
  created_at: string;
  last_viewed_at: string | null;
  source_id: string;
};

type SourceRow = { id: string; name: string; type: string };

const platformOptions = ["all", "vapi", "retell", "n8n", "make", "activepieces"] as const;
const statusOptions = ["all", "active", "paused", "expired"] as const;

function platformIcon(platform: string) {
  const props = { className: "h-5 w-5" };
  if (platform === "vapi") return <VapiLogo {...props} />;
  if (platform === "retell") return <RetellLogo {...props} />;
  if (platform === "n8n") return <N8nLogo {...props} />;
  if (platform === "make") return <MakeLogo {...props} />;
  return <ActivepiecesLogo {...props} />;
}

function timeAgo(value: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function StatusPill({ status }: { status: PortalRow["status"] }) {
  const style = status === "active" ? "bg-green-500" : status === "paused" ? "bg-gray-400" : "bg-red-500";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className="inline-flex items-center gap-2 text-sm text-gray-700"><span className={cn("h-2.5 w-2.5 rounded-full", style)} />{label}</span>;
}

export default function PortalsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [portals, setPortals] = useState<PortalRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<(typeof platformOptions)[number]>("all");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const sourceName = useMemo(() => new Map(sources.map((s) => [s.id, s.name])), [sources]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Please sign in again.");
      setLoading(false);
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", authData.user.id)
      .single();

    if (membershipError || !membership) {
      setError("Unable to resolve tenant membership.");
      setLoading(false);
      return;
    }

    setTenantId(membership.tenant_id);

    const [{ data: portalRows, error: portalError }, { data: sourceRows, error: sourceError }] = await Promise.all([
      supabase
        .from("client_portals")
        .select("id, name, platform_type, skeleton_id, status, client_id, token, created_at, last_viewed_at, source_id")
        .eq("tenant_id", membership.tenant_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sources")
        .select("id, name, type")
        .eq("tenant_id", membership.tenant_id),
    ]);

    if (portalError || sourceError) {
      setError(portalError?.message ?? sourceError?.message ?? "Failed to load portals.");
      setLoading(false);
      return;
    }

    setPortals((portalRows ?? []) as PortalRow[]);
    setSources((sourceRows ?? []) as SourceRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("portals-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_portals", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setPortals((prev) => prev.map((p) => (p.id === (payload.new as PortalRow).id ? { ...p, ...(payload.new as PortalRow) } : p)));
          return;
        }
        void loadData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, supabase, loadData]);

  const filtered = portals.filter((portal) => {
    if (query && !portal.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (platform !== "all" && portal.platform_type !== platform) return false;
    if (status !== "all" && portal.status !== status) return false;
    return true;
  });

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/client/${token}`);
  }

  async function toggleStatus(portal: PortalRow) {
    const nextStatus = portal.status === "active" ? "paused" : "active";
    const { error: updateError } = await supabase
      .from("client_portals")
      .update({ status: nextStatus })
      .eq("id", portal.id)
      .eq("tenant_id", tenantId ?? "");

    if (!updateError) {
      setPortals((prev) => prev.map((p) => (p.id === portal.id ? { ...p, status: nextStatus } : p)));
    }
  }

  async function removePortal(portal: PortalRow) {
    if (!confirm(`Delete portal \"${portal.name}\"? This cannot be undone.`)) return;
    const { error: deleteError } = await supabase
      .from("client_portals")
      .delete()
      .eq("id", portal.id)
      .eq("tenant_id", tenantId ?? "");

    if (!deleteError) {
      setPortals((prev) => prev.filter((p) => p.id !== portal.id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Portals</h1>
          <p className="mt-1 text-sm text-gray-600">Branded dashboards for your clients</p>
        </div>
        <button onClick={() => router.push("/control-panel/portals/create")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
          <Plus className="h-4 w-4" />
          New Portal
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search portals..." className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm" />
        </label>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" value={platform} onChange={(e) => setPlatform(e.target.value as (typeof platformOptions)[number])}>
          {platformOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All platforms" : option}</option>)}
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as (typeof statusOptions)[number])}>
          {statusOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All statuses" : option}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Viewed</th>
              <th className="px-4 py-3 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-gray-500" colSpan={7}>Loading portals...</td></tr>
            ) : error ? (
              <tr><td className="px-4 py-6 text-red-600" colSpan={7}>{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-12" colSpan={7}>
                  <div className="mx-auto max-w-md text-center">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><LayoutIcon /></div>
                    <p className="text-sm text-gray-700">No portals yet. Create your first client dashboard in seconds.</p>
                    <button onClick={() => router.push("/control-panel/portals/create")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                      <Plus className="h-4 w-4" /> Create Portal
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((portal) => (
                <tr key={portal.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/control-panel/portals/${portal.id}`)} className="font-medium text-blue-600 hover:underline">{portal.name}</button>
                    <p className="text-xs text-gray-500">{sourceName.get(portal.source_id) ?? "Unknown source"}</p>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-1">{platformIcon(portal.platform_type)}<span className="capitalize">{portal.platform_type}</span></span></td>
                  <td className="px-4 py-3"><StatusPill status={portal.status} /></td>
                  <td className="px-4 py-3 text-gray-700">{portal.client_id ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{timeAgo(portal.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{timeAgo(portal.last_viewed_at)}</td>
                  <td className="px-4 py-3 text-right relative">
                    <button onClick={() => setOpenMenuId((cur) => (cur === portal.id ? null : portal.id))} className="text-gray-400 hover:text-gray-700"><MoreVertical className="h-4 w-4" /></button>
                    {openMenuId === portal.id ? (
                      <KebabMenu
                        onViewDetails={() => router.push(`/control-panel/portals/${portal.id}`)}
                        onCopyLink={() => void copyLink(portal.token)}
                        onToggleStatus={() => void toggleStatus(portal)}
                        onDelete={() => void removePortal(portal)}
                        onClose={() => setOpenMenuId(null)}
                        active={portal.status === "active"}
                      />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function KebabMenu({
  onViewDetails,
  onCopyLink,
  onToggleStatus,
  onDelete,
  onClose,
  active,
}: {
  onViewDetails: () => void;
  onCopyLink: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onClose: () => void;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-4 top-9 z-10 w-48 rounded-lg border border-gray-200 bg-white py-2 text-left shadow-lg">
      <MenuButton icon={<Eye className="h-4 w-4" />} onClick={onViewDetails} label="View Details" />
      <MenuButton icon={<Copy className="h-4 w-4" />} onClick={onCopyLink} label="Copy Link" />
      <MenuButton icon={active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} onClick={onToggleStatus} label={active ? "Pause" : "Activate"} />
      <MenuButton icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} label="Delete" danger />
    </div>
  );
}

function MenuButton({ icon, onClick, label, danger = false }: { icon: ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100", danger ? "text-red-600" : "text-gray-700")}>
      {icon}
      {label}
    </button>
  );
}
