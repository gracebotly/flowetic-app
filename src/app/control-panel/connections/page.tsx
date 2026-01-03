

"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, Filter, LayoutGrid, MoreVertical } from "lucide-react";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";
type ConnectionMethod = "api" | "webhook" | "mcp";

type Source = {
  id: string;
  type: PlatformType;
  name: string;
  status: string | null;
  created_at?: string;
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

type TabKey = "all" | "credentials";
type StepKey = "platform" | "method" | "credentials" | "select";

const PLATFORM_LABEL: Record<PlatformType, string> = {
  n8n: "n8n",
  make: "Make",
  activepieces: "Activepieces",
  vapi: "Vapi",
  retell: "Retell",
};

function PlatformBadge({ platform, active }: { platform: PlatformType; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
      <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

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

function EntityIcon() {
  // Use existing "agent icons" component if available; keeping minimal + non-emoji fallback.
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
      <div className="h-5 w-5 rounded bg-rose-200" />
    </div>
  );
}

export default function ConnectionsPage() {
  const [tab, setTab] = useState<TabKey>("all");

  const [sources, setSources] = useState<Source[]>([]);
  const [entitiesBySource, setEntitiesBySource] = useState<Record<string, SourceEntity[]>>({});
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"last_updated" | "name">("last_updated");

  // Connect Platform modal (kept, minimal)
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<StepKey>("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<ConnectionMethod>("api");

  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");

  // n8n selection step
  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Record<string, boolean>>({});
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

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

        // Trigger type detection is not implemented yet; must not guess.
        // Use Webhook as a neutral placeholder until trigger parsing is implemented.
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
    const filtered = q
      ? rows.filter((r) => r.title.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q))
      : rows;

    const sorted =
      sort === "name"
        ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
        : [...filtered];

    return sorted;
  }, [sources, entitiesBySource, query, sort]);

  const credentialRows = useMemo(() => {
    return sources.map((s) => ({
      source: s,
      method: "api" as ConnectionMethod, // method is stored encrypted; do not guess it here yet
      active: s.status === "active",
      updated: s.created_at
        ? new Date(s.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
        : "",
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
    setN8nWorkflows([]);
    setSelectedWorkflowIds({});
    setCreatedSourceId(null);
  }

  function closeConnect() {
    setConnectOpen(false);
  }

  async function connectAndLoadCatalog() {
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

    // Load catalog with the same names as in n8n instance
    const listRes = await fetch(`/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`);
    const listJson = await listRes.json().catch(() => ({}));
    if (!listRes.ok || !listJson?.ok) {
      setErrMsg(listJson?.message || "Connected, but could not load workflows.");
      setBusy(false);
      return;
    }

    const wf = (listJson.workflows as N8nWorkflow[]) ?? [];
    setN8nWorkflows(wf);

    // default select all so user can unselect
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
      displayName: w.name, // SAME as in n8n
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

    // optional: import persists all workflows too; selection persists only chosen ones.
    // we only display indexed (source_entities) so this is safe.
    setBusy(false);
    closeConnect();
    await loadSourcesAndEntities();
    setTab("all");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="px-8 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900">Connections</h1>
            <p className="mt-2 text-sm text-gray-600">All</p>
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
              Sort by last updated
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
                    <EntityIcon />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">{r.title}</div>
                      <div className="truncate text-xs text-gray-500">{r.meta}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={r.platform} active={r.active} />
                      <TriggerBadge trigger={r.trigger} />
                      <button type="button" className="rounded p-1 hover:bg-gray-100">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Credentials tab content
            credentialRows.length === 0 ? (
              <div className="p-10 text-sm text-gray-600">No connected platforms yet.</div>
            ) : (
              <div>
                {credentialRows.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-4 border-b px-5 py-4 hover:bg-gray-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <div className="h-5 w-5 rounded bg-blue-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">{PLATFORM_LABEL[r.source.type]}</div>
                      <div className="truncate text-xs text-gray-500">{r.updated}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MethodBadge method={r.method} />
                      <button type="button" className="rounded p-1 hover:bg-gray-100">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Connect Platform Modal */}
      {connectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {step === "select" ? "Select Workflows" : step === "credentials" ? "Enter Credentials" : step === "method" ? "Choose Method" : "Connect Platform"}
              </h2>
              <button
                type="button"
                onClick={closeConnect}
                className="rounded p-1 hover:bg-gray-100"
                disabled={busy}
              >
                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error display */}
            {errMsg ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errMsg}</div>
            ) : null}

            {step === "platform" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Platform</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["n8n", "make", "activepieces", "vapi", "retell"] as PlatformType[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setSelectedPlatform(p);
                          setStep("method");
                        }}
                        className={`rounded-lg border-2 p-4 text-center transition-colors ${
                          selectedPlatform === p
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-lg font-semibold">{PLATFORM_LABEL[p]}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {p === "n8n" ? "Workflow automation" : 
                           p === "make" ? "Automation scenarios" :
                           p === "activepieces" ? "Open-source automation" :
                           "Voice agent platform"}
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
                    {[
                      { value: "api", label: "API Key", desc: "Use platform API key (recommended)" },
                      { value: "webhook", label: "Webhook", desc: "Receive webhook events" },
                      { value: "mcp", label: "MCP", desc: "Model Context Protocol" }
                    ].map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          setSelectedMethod(method.value as ConnectionMethod);
                          setStep("credentials");
                        }}
                        className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                          selectedMethod === method.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="font-semibold">{method.label}</div>
                        <div className="text-sm text-gray-500">{method.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("platform")}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ← Back to platform selection
                </button>
              </div>
            )}

            {step === "credentials" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instance URL</label>
                  <input
                    type="url"
                    value={instanceUrl}
                    onChange={(e) => setInstanceUrl(e.target.value)}
                    placeholder="https://your-n8n-instance.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    disabled={busy}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your n8n API key"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    disabled={busy}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={connectAndLoadCatalog}
                    disabled={busy || !apiKey || !instanceUrl}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {busy ? "Connecting..." : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("method")}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    disabled={busy}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === "select" && (
              <div className="space-y-4">
                <div className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {n8nWorkflows.map((w) => (
                      <label key={w.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selectedWorkflowIds[w.id]}
                          onChange={(e) => {
                            setSelectedWorkflowIds((prev) => ({
                              ...prev,
                              [w.id]: e.target.checked,
                            }));
                          }}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          disabled={busy}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{w.name}</div>
                          <div className="text-xs text-gray-500">ID: {w.id}</div>
                        </div>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          w.active 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {w.active ? "Active" : "Inactive"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{Object.values(selectedWorkflowIds).filter(Boolean).length} of {n8nWorkflows.length} workflows selected</span>
                  <button
                    type="button"
                    onClick={() => {
                      const all = n8nWorkflows.reduce((acc, w) => (acc[w.id] = true, acc), {} as Record<string, boolean>);
                      setSelectedWorkflowIds(all);
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Select all
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={saveN8nSelection}
                    disabled={busy || Object.values(selectedWorkflowIds).every(v => !v)}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {busy ? "Saving..." : "Save Selection"}
                  </button>
                  <button
                    type="button"
                    onClick={closeConnect}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

