"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getSkeletonDescription,
  getSkeletonDisplayName,
  getSkeletonForPlatform,
  type SkeletonId,
} from "@/lib/portals/platformToSkeleton";
import { MakeLogo, N8nLogo, RetellLogo, VapiLogo } from "@/components/connections/platform-icons";
import { CheckCircle2, ChevronDown, Copy, ExternalLink, Search } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Source = {
  id: string;
  name: string;
  type: string;
  status: string;
};

type IndexedEntity = {
  id: string;
  source_id: string;
  display_name: string;
  external_id: string;
  entity_kind: string;
  enabled_for_analytics: boolean;
  source_type?: string; // joined from sources
  source_name?: string; // joined from sources
  event_count?: number;
};

const SKELETONS = [
  "voice-performance",
  "workflow-operations",
  "roi-summary",
  "combined-overview",
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function icon(type: string) {
  const props = { className: "h-5 w-5" };
  if (type === "vapi") return <VapiLogo {...props} />;
  if (type === "retell") return <RetellLogo {...props} />;
  if (type === "n8n") return <N8nLogo {...props} />;
  if (type === "make") return <MakeLogo {...props} />;
  return <MakeLogo {...props} />;
}

function entityKindLabel(kind: string, platform: string): string {
  if (platform === "vapi") return "Assistant";
  if (platform === "retell") return "Agent";
  if (kind === "scenario") return "Scenario";
  return "Workflow";
}

/* ------------------------------------------------------------------ */
/* Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function CreatePortalPage() {
  const router = useRouter();
  const supabase = createClient();

  // Steps: entity → configure → success
  const [step, setStep] = useState<"entity" | "configure" | "success">("entity");
  const [entities, setEntities] = useState<IndexedEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected entity
  const [selectedEntity, setSelectedEntity] = useState<IndexedEntity | null>(null);

  // Configure step
  const [portalName, setPortalName] = useState("");
  const [clientId, setClientId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skeletonId, setSkeletonId] = useState<SkeletonId>("workflow-operations");
  const [expiry, setExpiry] = useState("never");

  // Success step
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Load indexed entities on mount                                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setError("Please log in.");
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", authData.user.id)
        .single();

      if (!membership) {
        setError("No tenant membership found.");
        setLoading(false);
        return;
      }

      const tenantId = membership.tenant_id;

      // Fetch indexed entities with source info
      const { data: entitiesData } = await supabase
        .from("source_entities")
        .select("id, source_id, display_name, external_id, entity_kind, enabled_for_analytics")
        .eq("tenant_id", tenantId)
        .eq("enabled_for_analytics", true);

      // Fetch sources for platform type info
      const { data: sourcesData } = await supabase
        .from("sources")
        .select("id, name, type, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      // Fetch event counts per entity (approximate via source_id + external_id)
      const { data: events } = await supabase
        .from("events")
        .select("source_id")
        .eq("tenant_id", tenantId);

      const eventCountBySource = new Map<string, number>();
      (events ?? []).forEach((e: { source_id: string }) =>
        eventCountBySource.set(e.source_id, (eventCountBySource.get(e.source_id) ?? 0) + 1)
      );

      const sourceMap = new Map(
        (sourcesData ?? []).map((s: Source) => [s.id, s])
      );

      const enriched: IndexedEntity[] = (entitiesData ?? []).map((entity: IndexedEntity) => {
        const source = sourceMap.get(entity.source_id);
        return {
          ...entity,
          source_type: source?.type ?? "unknown",
          source_name: source?.name ?? "Unknown Source",
          event_count: eventCountBySource.get(entity.source_id) ?? 0,
        };
      });

      setEntities(enriched);
      setLoading(false);
    })();
  }, [supabase]);

  /* ---------------------------------------------------------------- */
  /* Select entity → advance to configure                              */
  /* ---------------------------------------------------------------- */

  function selectEntity(entity: IndexedEntity) {
    setSelectedEntity(entity);
    const platform = entity.source_type ?? "make";
    const defaultSkeleton = getSkeletonForPlatform(platform);
    setSkeletonId(defaultSkeleton);
    setPortalName(`${entity.display_name} Dashboard`);
    setStep("configure");
  }

  /* ---------------------------------------------------------------- */
  /* Create portal                                                     */
  /* ---------------------------------------------------------------- */

  async function createPortal() {
    if (!selectedEntity || !portalName.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/portals/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: selectedEntity.source_id,
        entityId: selectedEntity.id,
        name: portalName.trim(),
        skeletonId,
        clientId: clientId || undefined,
        expiresIn: expiry === "never" ? undefined : expiry,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setError(json?.message || "Failed to create portal.");
      setLoading(false);
      return;
    }

    setCreatedToken(json.token);
    setStep("success");
    setLoading(false);
  }

  /* ---------------------------------------------------------------- */
  /* Filtered entities                                                 */
  /* ---------------------------------------------------------------- */

  const filteredEntities = entities.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.display_name.toLowerCase().includes(q) ||
      (e.source_name ?? "").toLowerCase().includes(q) ||
      e.entity_kind.toLowerCase().includes(q)
    );
  });

  /* ---------------------------------------------------------------- */
  /* Derived values                                                    */
  /* ---------------------------------------------------------------- */

  const url = createdToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/client/${createdToken}`
    : "";

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex min-h-[80vh] items-start justify-center pt-12">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Create Portal</h1>
          <p className="text-sm text-gray-500">
            Step {step === "entity" ? "1" : step === "configure" ? "2" : "3"} of 3
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* ── Step 1: Pick an Entity (Workflow/Scenario/Agent) ── */}
          {step === "entity" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                Which workflow should this portal display?
              </h2>
              <p className="text-sm text-gray-500">
                Pick a specific workflow, scenario, or agent from your indexed connections.
              </p>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workflows..."
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {loading && (
                <p className="text-sm text-gray-500">Loading indexed workflows...</p>
              )}

              {!loading && entities.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                  <p className="text-sm text-gray-600">
                    No indexed workflows found. Connect a platform and index some
                    workflows first.
                  </p>
                  <Link
                    href="/control-panel/connections"
                    className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Go to Connections →
                  </Link>
                </div>
              )}

              {!loading && filteredEntities.length > 0 && (
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {filteredEntities.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => selectEntity(entity)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      {icon(entity.source_type ?? "make")}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {entity.display_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entityKindLabel(entity.entity_kind, entity.source_type ?? "")} ·{" "}
                          {(entity.source_type ?? "").toUpperCase()} ·{" "}
                          {entity.source_name}
                          {(entity.event_count ?? 0) > 0 &&
                            ` · ${entity.event_count} events synced`}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-blue-600">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Configure ── */}
          {step === "configure" && selectedEntity && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Configure your portal</h2>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  {icon(selectedEntity.source_type ?? "make")}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedEntity.display_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedEntity.source_type ?? "").toUpperCase()} ·{" "}
                      {selectedEntity.source_name}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Portal Name
                </label>
                <input
                  value={portalName}
                  onChange={(e) => setPortalName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Acme Voice Analytics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Dashboard Type
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  {getSkeletonDisplayName(skeletonId)} —{" "}
                  {getSkeletonDescription(skeletonId)}
                </p>
              </div>

              {/* Advanced options */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ChevronDown
                  className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`}
                />
                Advanced options
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Override Dashboard Skeleton
                    </label>
                    <select
                      value={skeletonId}
                      onChange={(e) => setSkeletonId(e.target.value as SkeletonId)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {SKELETONS.map((s) => (
                        <option key={s} value={s}>
                          {getSkeletonDisplayName(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Expiry
                    </label>
                    <select
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="never">Never</option>
                      <option value="7d">7 days</option>
                      <option value="30d">30 days</option>
                      <option value="90d">90 days</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === "success" && selectedEntity && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Portal Created!</h2>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="break-all text-sm text-gray-800">{url}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(url)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </button>
                  <a
                    href={`/client/${createdToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Portal
                  </a>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Dashboard will show live data from:{" "}
                <strong>{selectedEntity.display_name}</strong> (
                {(selectedEntity.source_type ?? "").toUpperCase()}).
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/control-panel/portals")}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  ← Back to Portals
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => router.push("/control-panel/portals")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {step === "configure" && (
              <button
                onClick={() => setStep("entity")}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                Back
              </button>
            )}
            {step === "configure" && (
              <button
                onClick={() => void createPortal()}
                disabled={loading || !portalName.trim()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create Portal"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
