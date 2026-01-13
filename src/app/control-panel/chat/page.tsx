"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";

type PlatformType = "vapi" | "retell" | "n8n" | "make";
type Step = "platform" | "workflows" | "no_credentials";

type VibeConnection = {
  sourceId: string;
  platformType: PlatformType;
  name: string;
  status: string;
};

type IndexedEntity = {
  id: string;
  name: string;
  platform: string;
  kind: string;
  externalId: string;
  sourceId: string;
  lastSeenAt: string | null;
  createdAt: string;
  createdAtTs: number;
  lastUpdatedTs: number;
};

function platformLabel(p: PlatformType) {
  if (p === "vapi") return "Vapi";
  if (p === "retell") return "Retell";
  if (p === "n8n") return "n8n";
  return "Make";
}

function platformEntityNoun(p: PlatformType) {
  if (p === "vapi") return "assistants";
  if (p === "retell") return "agents";
  if (p === "n8n") return "workflows";
  return "scenarios";
}

export default function ControlPanelChatWizardPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [step, setStep] = useState<Step>("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [connections, setConnections] = useState<VibeConnection[]>([]);
  const [indexedEntities, setIndexedEntities] = useState<IndexedEntity[]>([]);

  // Step 2 list state
  const [q, setQ] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  async function loadContext() {
    setLoading(true);
    setErr(null);

    try {
      const [ctxRes, idxRes] = await Promise.all([
        fetch("/api/vibe/context", { method: "GET" }),
        fetch("/api/indexed-entities/list", { method: "GET" }),
      ]);

      const ctxJson = await ctxRes.json().catch(() => ({}));
      const idxJson = await idxRes.json().catch(() => ({}));

      if (!ctxRes.ok || !ctxJson?.ok) {
        setErr(ctxJson?.message || "Failed to load connection context.");
        setLoading(false);
        return;
      }

      if (!idxRes.ok || !idxJson?.ok) {
        setErr(idxJson?.message || "Failed to load indexed entities.");
        setLoading(false);
        return;
      }

      const snapshot = ctxJson?.snapshot || {};
      const conns: VibeConnection[] = Array.isArray(snapshot?.connections)
        ? snapshot.connections.map((c: any) => ({
            sourceId: String(c.sourceId || c.id || ""),
            platformType: String(c.platformType || c.type || "") as PlatformType,
            name: String(c.name || c.platformType || c.type || ""),
            status: String(c.status || "active"),
          }))
        : [];

      const entities: IndexedEntity[] = Array.isArray(idxJson?.entities) ? idxJson.entities : [];

      setConnections(conns.filter((c) => !!c.sourceId));
      setIndexedEntities(entities);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to load chat setup context.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContext();
    // Support deep-linking from Connections:
    const setup = String(search?.get("setup") || "").trim().toLowerCase();
    if (setup === "vapi" || setup === "retell" || setup === "n8n" || setup === "make") {
      setSelectedPlatform(setup as PlatformType);
      // Step transition happens after context loads; we handle in effect below
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const platformStatus = useMemo(() => {
    const byPlatform = new Map<PlatformType, { hasCredentials: boolean; indexedCount: number }>();
    const platforms: PlatformType[] = ["vapi", "retell", "n8n", "make"];

    for (const p of platforms) {
      const hasCredentials = connections.some((c) => c.platformType === p && c.status === "active");
      const indexedCount = indexedEntities.filter((e) => String(e.platform) === p).length;
      byPlatform.set(p, { hasCredentials, indexedCount });
    }
    return byPlatform;
  }, [connections, indexedEntities]);

  const filteredIndexedForPlatform = useMemo(() => {
    if (!selectedPlatform) return [];
    const rows = indexedEntities.filter((e) => String(e.platform) === selectedPlatform);
    const qq = q.trim().toLowerCase();
    const out = qq
      ? rows.filter((r) => String(r.name || "").toLowerCase().includes(qq))
      : rows;

    // Sort by lastUpdatedTs desc (already computed in API)
    out.sort((a, b) => (b.lastUpdatedTs || 0) - (a.lastUpdatedTs || 0));
    return out;
  }, [indexedEntities, selectedPlatform, q]);

  function startPlatform(p: PlatformType) {
    setErr(null);
    setSelectedEntityId(null);
    setQ("");
    setSelectedPlatform(p);

    const status = platformStatus.get(p);
    if (!status?.hasCredentials) {
      setStep("no_credentials");
      return;
    }

    // If they have credentials but no indexed entities, still go to workflows step
    setStep("workflows");
  }

  function goToConnectionsSetup() {
    if (!selectedPlatform) return;
    router.push(`/control-panel/connections?setup=${encodeURIComponent(selectedPlatform)}`);
  }

  function selectEntityAndLaunch(entity: IndexedEntity) {
    if (!selectedPlatform) return;

    const context = {
      platformType: selectedPlatform,
      sourceId: String(entity.sourceId),
      entityId: String(entity.id),
      externalId: String(entity.externalId),
      displayName: String(entity.name || ""),
      entityKind: String(entity.kind || ""),
      skillMD: selectedPlatform, // loader key
      lastIndexed: entity.lastSeenAt ?? null,
      eventCount: null,
    };

    sessionStorage.setItem("vibeContext", JSON.stringify(context));
    router.push("/vibe/chat");
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">Chat</h1>
        <p className="mt-1 text-sm text-gray-600">Choose a platform and an indexed entity to start building.</p>
      </div>

      {err ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading…</div>
      ) : null}

      {!loading && step === "platform" ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 text-sm font-semibold text-gray-900">Choose how you want to start</div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(["vapi", "retell", "n8n", "make"] as PlatformType[]).map((p) => {
              const st = platformStatus.get(p);
              const hasCreds = !!st?.hasCredentials;
              const count = st?.indexedCount ?? 0;

              return (
                <div key={p} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{platformLabel(p)}</div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                        {hasCreds ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>{count} indexed</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span>Not setup</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => startPlatform(p)}
                    className="mt-4 w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    Select
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/vibe/chat")}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-left hover:bg-gray-50"
            >
              <div className="text-sm font-semibold text-gray-900">Start with Template</div>
              <div className="mt-1 text-sm text-gray-600">Try the app without adding credentials.</div>
            </button>
          </div>
        </div>
      ) : null}

      {!loading && step === "no_credentials" && selectedPlatform ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep("platform");
                setSelectedPlatform(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="text-sm font-semibold text-gray-900">{platformLabel(selectedPlatform)}</div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-white text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="text-base font-semibold text-gray-900">Credentials Not Added Yet</div>
            <div className="mt-2 text-sm text-gray-600">
              To build UI for your {platformLabel(selectedPlatform)} {platformEntityNoun(selectedPlatform)}, you need to:
              <div className="mt-2 space-y-1 text-left max-w-md mx-auto">
                <div>1. Add your {platformLabel(selectedPlatform)} credentials</div>
                <div>2. Select which {platformEntityNoun(selectedPlatform)} to index</div>
                <div>3. Come back here to start building</div>
              </div>
            </div>

            <button
              type="button"
              onClick={goToConnectionsSetup}
              className="mt-5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Add {platformLabel(selectedPlatform)} Credentials →
            </button>
          </div>
        </div>
      ) : null}

      {!loading && step === "workflows" && selectedPlatform ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep("platform");
                setSelectedPlatform(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="text-sm font-semibold text-gray-900">
              {platformLabel(selectedPlatform)} {platformEntityNoun(selectedPlatform)}
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            Select an indexed {platformEntityNoun(selectedPlatform).slice(0, -1)} to build UI for.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${platformEntityNoun(selectedPlatform)}...`}
              className="md:col-span-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
            />
            <button
              type="button"
              onClick={loadContext}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            {filteredIndexedForPlatform.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">
                No indexed {platformEntityNoun(selectedPlatform)} found.
                <div className="mt-2">
                  Go to Connections and index at least one {platformEntityNoun(selectedPlatform)}.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredIndexedForPlatform.map((e) => {
                  const active = selectedEntityId === e.id;
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{e.name}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">{e.externalId}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntityId(e.id);
                          selectEntityAndLaunch(e);
                        }}
                        className="shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                      >
                        Select →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}