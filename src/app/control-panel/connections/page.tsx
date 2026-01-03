"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Search, ChevronDown, Filter, LayoutGrid, KeyRound, Webhook as WebhookIcon, Bot } from "lucide-react";
import { ActivepiecesLogo, MakeLogo, N8nLogo, RetellLogo, VapiLogo } from "@/components/connections/platform-icons";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";
type ConnectionMethod = "api" | "webhook" | "mcp";

type Source = {
  id: string;
  type: PlatformType;
  name: string;
  status: string | null;
};

type SourceEntity = {
  id: string;
  source_id: string;
  entity_kind: "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";
  external_id: string;
  display_name: string;
  enabled_for_analytics: boolean;
  enabled_for_actions: boolean;
  last_seen_at: string | null;
  created_at?: string;
  updated_at?: string;
};

type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  triggerType: "Webhook" | "Schedule" | "Chat" | "Form";
  updatedAt: string | null;
  createdAt: string | null;
};

const PLATFORM_META: Record<
  PlatformType,
  {
    label: string;
    description: string;
    Icon: React.ComponentType<{ className?: string }>;
    supportsMcp: boolean;
  }
> = {
  n8n: { label: "n8n", description: "Workflow automation", Icon: N8nLogo, supportsMcp: true },
  make: { label: "Make", description: "Automation scenarios", Icon: MakeLogo, supportsMcp: true },
  activepieces: { label: "Activepieces", description: "Open-source automation", Icon: ActivepiecesLogo, supportsMcp: true },
  vapi: { label: "Vapi", description: "Voice agent platform", Icon: VapiLogo, supportsMcp: false },
  retell: { label: "Retell", description: "Voice agent platform", Icon: RetellLogo, supportsMcp: false },
};

function TriggerBadge({ trigger }: { trigger: "Webhook" | "Schedule" | "Chat" | "Form" }) {
  const styles =
    trigger === "Webhook"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : trigger === "Schedule"
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : trigger === "Chat"
      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
      : "bg-pink-50 text-pink-800 border-pink-200";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${styles}`}>
      {trigger}
    </span>
  );
}

function MethodBadge({ method }: { method: ConnectionMethod }) {
  const styles =
    method === "api"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : method === "webhook"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-pink-50 text-pink-800 border-pink-200";
  const label = method === "api" ? "API" : method === "webhook" ? "Webhook" : "MCP";
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${styles}`}>{label}</span>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {active ? "Connected" : "Disconnected"}
    </span>
  );
}

export default function ConnectionsPage() {
  // Step 3 tabs
  const [tab, setTab] = useState<"all" | "credentials">("all");

  // data
  const [sources, setSources] = useState<Source[]>([]);
  const [entitiesBySource, setEntitiesBySource] = useState<Record<string, SourceEntity[]>>({});
  const [loading, setLoading] = useState(true);

  // toolbar
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"last_updated" | "name">("last_updated");

  // connect modal (keep old flow styling)
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<"platform" | "method" | "credentials" | "select">("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<ConnectionMethod>("api");

  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");

  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // credentials menu
  const [openCredentialMenuId, setOpenCredentialMenuId] = useState<string | null>(null);

  async function loadSourcesAndEntities() {
    setLoading(true);
    setErrMsg(null);

    const sRes = await fetch("/api/connections/list");
    const sJson = await sRes.json().catch(() => ({}));
    if (!sRes.ok || !sJson?.ok) {
      setSources([]);
      setEntitiesBySource({});
      setLoading(false);
      setErrMsg(sJson?.message || "Failed to load connections.");
      return;
    }

    const srcs = (sJson.sources as Source[]) ?? [];
    setSources(srcs);

    const entries = await Promise.all(
      srcs.map(async (s) => {
        const eRes = await fetch(`/api/connections/entities/list?sourceId=${encodeURIComponent(s.id)}`);
        const eJson = await eRes.json().catch(() => ({}));
        return [s.id, eRes.ok && eJson?.ok ? ((eJson.entities as SourceEntity[]) ?? []) : []] as const;
      }),
    );

    const map: Record<string, SourceEntity[]> = {};
    for (const [sid, ents] of entries) map[sid] = ents;

    setEntitiesBySource(map);
    setLoading(false);
  }

  useEffect(() => {
    loadSourcesAndEntities();
  }, []);

  const indexedRows = useMemo(() => {
    const rows: Array<{
      key: string;
      platform: PlatformType;
      title: string;
      meta: string;
      trigger: "Webhook" | "Schedule" | "Chat" | "Form";
      active: boolean;
    }> = [];

    for (const s of sources) {
      const ents = entitiesBySource[s.id] ?? [];
      for (const e of ents) {
        const updated = e.updated_at ? new Date(e.updated_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : null;
        const created = e.created_at ? new Date(e.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : null;

        const metaParts = [];
        if (updated) metaParts.push(`Last updated ${updated}`);
        if (created) metaParts.push(`Created ${created}`);
        const meta = metaParts.join(" | ");

        // Trigger parsing is not implemented; do not guess. Use Webhook placeholder.
        rows.push({
          key: `${s.id}:${e.external_id}`,
          platform: s.type,
          title: e.display_name,
          meta,
          trigger: "Webhook",
          active: s.status === "active",
        });
      }
    }

    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;

    return sort === "name" ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered;
  }, [sources, entitiesBySource, query, sort]);

  const credentialRows = useMemo(() => {
    return sources.map((s) => ({
      source: s,
      // do not guess method from encrypted secret yet
      method: "api" as ConnectionMethod,
      active: s.status === "active",
      updated: new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }),
    }));
  }, [sources]);

  function openConnect() {
    setErrMsg(null);
    setBusy(false);
    setConnectOpen(true);
    setStep("platform");
    setSelectedPlatform(null);
    setSelectedMethod("api");
    setApiKey("");
    setInstanceUrl("");
    setCreatedSourceId(null);
    setN8nWorkflows([]);
    setSelectedWorkflowIds({});
  }

  function closeConnect() {
    setConnectOpen(false);
  }

  async function connectAndLoadN8nCatalog() {
    if (!selectedPlatform) return;

    setErrMsg(null);
    setBusy(true);

    if (selectedPlatform !== "n8n") {
      setErrMsg("Only n8n is wired in this flow right now.");
      setBusy(false);
      return;
    }

    if (selectedMethod !== "api") {
      setErrMsg("Only API is wired for n8n right now.");
      setBusy(false);
      return;
    }

    if (!apiKey) {
      setErrMsg("n8n API key is required.");
      setBusy(false);
      return;
    }
    if (!instanceUrl) {
      setErrMsg("n8n instance URL is required.");
      setBusy(false);
      return;
    }

    const payload: any = {
      platformType: "n8n",
      method: "api",
      name: "n8n",
      apiKey,
      instanceUrl,
      n8nAuthMode: "header",
    };

    const res = await fetch("/api/connections/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setErrMsg(json?.message || "Connection failed.");
      setBusy(false);
      return;
    }

    const sourceId = json?.source?.id as string | undefined;
    if (!sourceId) {
      setErrMsg("Connected, but no source ID returned.");
      setBusy(false);
      return;
    }

    setCreatedSourceId(sourceId);

    const listRes = await fetch(`/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`);
    const listJson = await listRes.json().catch(() => ({}));
    if (!listRes.ok || !listJson?.ok) {
      setErrMsg(listJson?.message || "Connected, but could not load workflows.");
      setBusy(false);
      return;
    }

    const wf = (listJson.workflows as N8nWorkflow[]) ?? [];
    setN8nWorkflows(wf);

    const sel: Record<string, boolean> = {};
    for (const w of wf) sel[w.id] = true;
    setSelectedWorkflowIds(sel);

    setStep("select");
    setBusy(false);
  }

  async function saveN8nSelection() {
    if (!createdSourceId) return;

    setErrMsg(null);
    setBusy(true);

    const selected = n8nWorkflows.filter((w) => selectedWorkflowIds[w.id]);
    const entities = selected.map((w) => ({
      entityKind: "workflow",
      externalId: w.id,
      displayName: w.name, // same as in n8n
      enabledForAnalytics: true,
      enabledForActions: false,
    }));

    const res = await fetch("/api/connections/entities/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: createdSourceId, entities }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setErrMsg(json?.message || "Failed to save workflow selection.");
      setBusy(false);
      return;
    }

    setBusy(false);
    setConnectOpen(false);
    await loadSourcesAndEntities();
    setTab("all");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="px-8 pt-6">
        {/* Header (match your desired UI) */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900">Connections</h1>
            <p className="mt-2 text-sm text-gray-600">All the workflows, agents and credentials you have access to</p>
          </div>

          <button
            type="button"
            onClick={openConnect}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <span className="text-lg leading-none">+</span>
            Connect Platform
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b">
          <div className="flex gap-8">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`pb-3 text-sm font-semibold ${
                tab === "all" ? "border-b-2 border-orange-600 text-orange-600" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTab("credentials")}
              className={`pb-3 text-sm font-semibold ${
                tab === "credentials"
                  ? "border-b-2 border-orange-600 text-orange-600"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Credentials
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
              placeholder={tab === "all" ? "Search workflows & agents..." : "Search credentials..."}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setSort((p) => (p === "last_updated" ? "name" : "last_updated"))}
            >
              Sort by {sort === "last_updated" ? "name" : "last updated"}
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            <button type="button" className="rounded-lg border bg-white p-2 hover:bg-gray-50" title="Filter">
              <Filter className="h-4 w-4 text-gray-500" />
            </button>
            <button type="button" className="rounded-lg border bg-white p-2 hover:bg-gray-50" title="View">
              <LayoutGrid className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        {errMsg ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errMsg}</div>
        ) : null}

        {/* List */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-white">
          {loading ? (
            <div className="p-6 text-sm text-gray-600">Loading…</div>
          ) : tab === "all" ? (
            indexedRows.length === 0 ? (
              <div className="p-10 text-sm text-gray-600">No indexed workflows or agents yet.</div>
            ) : (
              <div>
                {indexedRows.map((r) => (
                  <div key={r.key} className="flex items-center gap-4 border-b px-5 py-4 hover:bg-gray-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                      <div className="h-5 w-5 rounded bg-rose-200" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900">{r.title}</div>
                      <div className="text-sm text-gray-500">{r.meta}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TriggerBadge trigger={r.trigger} />
                      <StatusPill active={r.active} />
                    </div>
                  </div>
                ))}

                {/* Bottom pagination */}
                <div className="border-t px-5 py-3 text-sm text-gray-500">
                  Showing {indexedRows.length} of {indexedRows.length}
                </div>
              </div>
            )
          ) : (
            <div>
              {credentialRows.length === 0 ? (
                <div className="p-10 text-sm text-gray-600">No platform credentials yet.</div>
              ) : (
                <div>
                  {credentialRows.map((r) => (
                    <div key={r.source.id} className="flex items-center gap-4 border-b px-5 py-4 hover:bg-gray-50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <KeyRound className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">{r.source.name}</div>
                        <div className="text-sm text-gray-500">{r.updated}</div>
                      </div>

                      <div className="flex items-center gap-2 relative">
                        <MethodBadge method={r.method} />

                        <StatusPill active={r.active} />

                        <button
                          type="button"
                          className="rounded p-1 hover:bg-gray-100"
                          onClick={() => setOpenCredentialMenuId((prev) => (prev === r.source.id ? null : r.source.id))}
                        >
                          <MoreVertical className="h-4 w-4 text-gray-400" />
                        </button>

                        {openCredentialMenuId === r.source.id ? (
                          <div className="absolute right-0 top-9 z-50 w-48 rounded-lg border bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
                              onClick={() => {
                                setOpenCredentialMenuId(null);
                                // placeholder: open details modal later
                                alert("View Details");
                              }}
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
                              onClick={() => {
                                setOpenCredentialMenuId(null);
                                alert("Configure");
                              }}
                            >
                              Configure
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
                              onClick={() => {
                                setOpenCredentialMenuId(null);
                                alert("Edit");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setOpenCredentialMenuId(null);
                                alert("Delete");
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {/* Bottom pagination */}
                  <div className="border-t px-5 py-3 text-sm text-gray-500">
                    Showing {credentialRows.length} of {credentialRows.length}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connect Platform Modal */}
        {connectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {step === "select" ? "Select Workflows" : step === "credentials" ? "Enter Credentials" : step === "method" ? "Choose Method" : "Connect Platform"}
                </h2>

                <button
                  type="button"
                  className="rounded p-1 hover:bg-gray-100"
                  onClick={closeConnect}
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {step === "platform" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Platform</label>
                    <div className="space-y-3">
                      {(["n8n", "make", "activepieces", "vapi", "retell"] as PlatformType[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setSelectedPlatform(p);
                            setStep("method");
                          }}
                          className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                            selectedPlatform === p ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                            <span className="text-sm font-bold text-gray-700">{PLATFORM_META[p].label}</span>
                          </div>
                          <div>
                            <div className="text-base font-semibold text-gray-900">{PLATFORM_META[p].label}</div>
                            <div className="text-sm text-gray-500">{PLATFORM_META[p].description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === "method" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Connection Method</label>
                    <div className="space-y-2">
                      {(["api", "webhook"] as ConnectionMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setSelectedMethod(m);
                            if (m === "api") {
                              setStep("credentials");
                            } else {
                              setErrMsg("Webhook method not yet implemented.");
                            }
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            selectedMethod === m ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="font-medium">{m === "api" ? "API Key" : "Webhook Endpoint"}</div>
                          <div className="text-sm text-gray-500">
                            {m === "api"
                              ? "Connect using API key and instance URL"
                              : "Connect using webhook endpoint for real-time events"}
                          </div>
                        </button>
                      ))}

                      {selectedPlatform && PLATFORM_META[selectedPlatform].supportsMcp ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMethod("mcp");
                            setErrMsg("MCP method not yet implemented.");
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            selectedMethod === "mcp"
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="font-medium">Model Context Protocol (MCP)</div>
                          <div className="text-sm text-gray-500">Connect using MCP for streaming workflows</div>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {step === "credentials" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
                      placeholder="Enter your n8n API key"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instance URL</label>
                    <input
                      type="url"
                      value={instanceUrl}
                      onChange={(e) => setInstanceUrl(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
                      placeholder="https://your-n8n-instance.com"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={connectAndLoadN8nCatalog}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy ? "Loading…" : "Continue"}
                  </button>
                </div>
              )}

              {step === "select" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Select Workflows</label>
                      <button
                        type="button"
                        onClick={() => {
                          const sel: Record<string, boolean> = {};
                          for (const w of n8nWorkflows) sel[w.id] = true;
                          setSelectedWorkflowIds(sel);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {n8nWorkflows.map((w) => (
                        <label key={w.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={selectedWorkflowIds[w.id] ?? false}
                            onChange={(e) =>
                              setSelectedWorkflowIds((prev) => ({ ...prev, [w.id]: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1 text-sm">{w.name}</div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveN8nSelection}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Import Selected"}
                  </button>
                </div>
              )}

              {errMsg && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errMsg}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}