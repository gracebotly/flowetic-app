"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Webhook as WebhookIcon, Bot } from "lucide-react";
import { ActivepiecesLogo, MakeLogo, N8nLogo, RetellLogo, VapiLogo } from "@/components/connections/platform-icons";

type Source = {
  id: string;
  type: string;
  name: string;
  status: string | null;
};

type FilterKey = "all" | "needs_attention";

const PLATFORM_META: Record<
  string,
  {
    label: string;
    description: string;
    Icon: React.ComponentType<{ className?: string }>;
    category: "automations" | "voice_ai";
    supportsMcp: boolean;
  }
> = {
  n8n: { label: "n8n", description: "Workflow automation", Icon: N8nLogo, category: "automations", supportsMcp: true },
  make: { label: "Make", description: "Automation scenarios", Icon: MakeLogo, category: "automations", supportsMcp: true },
  activepieces: { label: "Activepieces", description: "Open-source automation", Icon: ActivepiecesLogo, category: "automations", supportsMcp: true },
  vapi: { label: "Vapi", description: "Voice agent platform", Icon: VapiLogo, category: "voice_ai", supportsMcp: false },
  retell: { label: "Retell", description: "Voice agent platform", Icon: RetellLogo, category: "voice_ai", supportsMcp: false },
};

function needsAttention(status: string | null) {
  return status === "error" || status === "inactive" || status === "attention";
}

function StatusPill({ status }: { status: string | null }) {
  if (!needsAttention(status)) return null;
  
  const text =
    status === "error"
      ? "Error"
      : status === "inactive"
      ? "Connected • Not indexing"
      : "Attention needed";

  const styles =
    status === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : status === "inactive"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {text}
    </span>
  );
}

type ConnectMethod = "api" | "webhook" | "mcp";

type EntityDraft = {
  externalId: string;
  displayName: string;
  entityKind: "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";
  enabledForAnalytics: boolean;
  enabledForActions: boolean;
};

export default function ConnectionsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  // Modal state
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<"platform" | "method" | "credentials" | "success">("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PLATFORM_META | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<ConnectMethod>("api");

  // credentials
  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [connectionName, setConnectionName] = useState("");

  // connected source id (created)
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);

  
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // workflow management state
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSourceId, setManageSourceId] = useState<string | null>(null);
  const [manageEntities, setManageEntities] = useState<any[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  async function refreshSources() {
    setLoading(true);
    setErrMsg(null);
    const res = await fetch("/api/connections/list", { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setSources([]);
      setLoading(false);
      setErrMsg(json?.message || "Failed to load connections.");
      return;
    }
    setSources((json.sources as Source[]) ?? []);
    setLoading(false);

    setTimeout(() => {
      for (const s of (json.sources as Source[]) ?? []) {
        if (s.type === "n8n") refreshEntityCount(s.id);
      }
    }, 0);
  }

  async function refreshEntityCount(sourceId: string) {
    const res = await fetch(`/api/connections/entities/list?sourceId=${encodeURIComponent(sourceId)}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) {
      setEntityCounts((prev) => ({ ...prev, [sourceId]: (json.entities?.length ?? 0) }));
    }
  }

  useEffect(() => {
    refreshSources();
  }, []);

  const filteredSources = useMemo(() => {
    if (filter === "needs_attention") return sources.filter((s) => needsAttention(s.status));
    return sources;
  }, [sources, filter]);

  const automations = filteredSources.filter((s) => PLATFORM_META[String(s.type)]?.category === "automations");
  const voice = filteredSources.filter((s) => PLATFORM_META[String(s.type)]?.category === "voice_ai");
  
  const hasAttention = sources.some((s) => needsAttention(s.status));

  function resetModal() {
    setStep("platform");
    setSelectedPlatform(null);
    setSelectedMethod("api");
    setApiKey("");
    setInstanceUrl("");
    setMcpUrl("");
    setAuthHeader("");
    setConnectionName("");
    setCreatedSourceId(null);
    setSaving(false);
    setErrMsg(null);
  }

  function openConnect() {
    resetModal();
    setConnectOpen(true);
  }

  function closeConnect() {
    setConnectOpen(false);
    resetModal();
  }

  async function openManageWorkflows(sourceId: string) {
    setManageSourceId(sourceId);
    setManageError(null);
    setManageOpen(true);
    setManageLoading(true);
    
    try {
      const res = await fetch(`/api/connections/entities/list?sourceId=${encodeURIComponent(sourceId)}`);
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok || !json?.ok) {
        setManageError(json?.message || "Failed to load workflows.");
        setManageEntities([]);
      } else {
        setManageEntities(json.entities ?? []);
      }
    } catch (error) {
      setManageError("Failed to load workflows.");
      setManageEntities([]);
    } finally {
      setManageLoading(false);
    }
  }

  async function createConnection() {
    if (!selectedPlatform) return;

    setSaving(true);
    setErrMsg(null);

    const payload: any = {
      platformType: selectedPlatform,
      method: selectedMethod,
      name: connectionName || PLATFORM_META[selectedPlatform].label,
    };

    if (selectedMethod === "api") {
      payload.apiKey = apiKey;
      if (instanceUrl) payload.instanceUrl = instanceUrl;
      if (selectedPlatform === "n8n" && !instanceUrl) {
        setErrMsg("Instance URL is required for n8n connections.");
        setSaving(false);
        return;
      }
    }
    if (selectedMethod === "webhook") {
      if (instanceUrl) payload.instanceUrl = instanceUrl;
      if (selectedPlatform === "n8n" && !instanceUrl) {
        setErrMsg("Instance URL is required for n8n connections.");
        setSaving(false);
        return;
      }
    }
    if (selectedMethod === "mcp") {
      payload.mcpUrl = mcpUrl;
      if (authHeader) payload.authHeader = authHeader;
    }

    const res = await fetch("/api/connections/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setSaving(false);
      setErrMsg(json?.message || "Connection failed. Please check your credentials.");
      return;
    }

    const sourceId = json?.source?.id as string | undefined;
    if (!sourceId) {
      setSaving(false);
      setErrMsg("Connection succeeded but no source ID returned.");
      return;
    }

    setCreatedSourceId(sourceId);

    // n8n + API: auto-import workflows immediately
    if (selectedPlatform === "n8n" && selectedMethod === "api") {
      const importRes = await fetch("/api/connections/inventory/n8n/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const importJson = await importRes.json().catch(() => ({}));
      if (!importRes.ok || !importJson?.ok) {
        setErrMsg(importJson?.message || "Connected, but workflow import failed.");
        setStep("credentials");
        return;
      }
    }
    
    setStep("success");
    setSaving(false);

    // refresh cards in background
    refreshSources();
  }

  

  return (
    <div className="min-h-screen">
      <div className="px-8 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Connections</h1>
          </div>

          <button
            type="button"
            onClick={openConnect}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Connect Platform
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={
              filter === "all"
                ? "rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            }
          >
            All
          </button>
          {hasAttention ? (
            <button
              type="button"
              onClick={() => setFilter("needs_attention")}
              className={
                filter === "needs_attention"
                  ? "rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              }
            >
              Needs attention
            </button>
          ) : null}
        </div>

        {errMsg ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 text-sm text-gray-600">Loading connections…</div>
        ) : null}

        {!loading && sources.length === 0 ? (
          <div className="mt-10 rounded-xl border bg-white p-10">
            <h2 className="text-lg font-semibold text-gray-900">No connections yet</h2>
            <p className="mt-1 text-sm text-gray-600">
              Connect a platform to import your agents/workflows and start tracking events.
            </p>
            <button
              type="button"
              onClick={openConnect}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Connect Platform
            </button>
          </div>
        ) : null}

        {/* Grouped sections */}
        {!loading && sources.length > 0 ? (
          <div className="mt-8 space-y-10">
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Automations</h2>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {automations.map((s) => {
                  const meta = PLATFORM_META[String(s.type)];
                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                            <meta.Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">{meta?.label || s.name}</div>
                            <div className="text-sm text-gray-600">{meta?.description || "Connected platform"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.type !== "n8n" ? <StatusPill status={s.status} /> : null}
                        </div>
                      </div>

                      <div className="mt-6 text-sm text-gray-600">
                        {s.type === "n8n" ? (
                          <div>Workflows: {entityCounts[s.id] ?? "—"}</div>
                        ) : (
                          <>
                            <div>Indexing selection required after connect.</div>
                            <div className="mt-1 text-gray-500">Tenant-level connection</div>
                          </>
                        )}
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                          type="button"
                          onClick={s.type === "n8n" ? () => openManageWorkflows(s.id) : undefined}
                          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                        >
                          {s.type === "n8n" ? "Manage Workflows" : "View Details"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          View Activity
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Voice AI</h2>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {voice.map((s) => {
                  const meta = PLATFORM_META[String(s.type)];
                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl border p-6 ${
                        statusBucket(s.status) === "attention" ? "border-red-200 bg-red-50" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                            <meta.Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">{meta?.label || s.name}</div>
                            <div className="text-sm text-gray-600">{meta?.description || "Connected platform"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.type !== "n8n" ? <StatusPill status={s.status} /> : null}
                        </div>
                      </div>

                      <div className="mt-6 text-sm text-gray-600">
                        <div>Webhooks recommended for real-time analytics.</div>
                        <div className="mt-1 text-gray-500">Tenant-level connection</div>
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                          type="button"
                          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          View Activity
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {/* Connect Platform Modal (in-page) */}
      {connectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-gray-900">
                    {step === "platform"
                      ? "Connect Platform"
                      : step === "method"
                      ? `Connect ${selectedPlatform ? PLATFORM_META[selectedPlatform].label : ""}`
                      : step === "credentials"
                      ? `Credentials`
                      : "Connected"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {step === "platform"
                      ? "Choose which platform you want to connect."
                      : step === "method"
                      ? "Choose a connection method."
                      : step === "credentials"
                      ? "Enter credentials to validate and connect."
                      : "Success."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeConnect}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              {errMsg ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errMsg}
                </div>
              ) : null}

              {step !== "platform" ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrMsg(null);
                    if (step === "method") setStep("platform");
                    else if (step === "credentials") setStep("method");
                  }}
                  className="mb-4 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
              ) : null}

              {step === "platform" ? (
                <div className="space-y-3">
                  {(Object.keys(PLATFORM_META) as Array<keyof typeof PLATFORM_META>).map((k) => {
                    const Icon = PLATFORM_META[k].Icon;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSelectedPlatform(k);
                          setErrMsg(null);
                          setStep("method");
                        }}
                        className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-slate-50"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900">{PLATFORM_META[k].label}</div>
                          <div className="text-sm text-gray-600">{PLATFORM_META[k].description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {step === "method" ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMethod("api");
                      setErrMsg(null);
                      setStep("credentials");
                    }}
                    className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-left hover:border-emerald-400"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                        <KeyRound className="h-5 w-5 text-emerald-700" />
                        API Key
                      </div>
                      <span className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white">RECOMMENDED</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      {selectedPlatform === "n8n" 
                        ? "Connect via API to auto-import workflows."
                        : "Connect via API to import your catalog for analytics."}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMethod("webhook");
                      setErrMsg(null);
                      setStep("credentials");
                    }}
                    className="w-full rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <WebhookIcon className="h-5 w-5 text-slate-700" />
                      Webhook Only
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      Manual event forwarding. No catalog import.
                    </div>
                  </button>

                  {selectedPlatform && PLATFORM_META[selectedPlatform].supportsMcp ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMethod("mcp");
                        setErrMsg(null);
                        setStep("credentials");
                      }}
                      className="w-full rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                        <Bot className="h-5 w-5 text-slate-700" />
                        MCP (Actions)
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        Actions only
                      </div>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {step === "credentials" ? (
                <div className="space-y-4">
                  {selectedMethod === "api" ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">API Key *</label>
                        <input
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          type="password"
                          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          placeholder="••••••••••••••"
                        />
                      </div>

                      {(selectedPlatform === "n8n" || selectedPlatform === "activepieces") ? (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-gray-900">Instance URL{selectedPlatform === "activepieces" ? " (optional)" : ""}</label>
                          <input
                            value={instanceUrl}
                            onChange={(e) => setInstanceUrl(e.target.value)}
                            type="url"
                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="https://your-instance..."
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {selectedMethod === "webhook" ? (
                    <>
                      {(selectedPlatform === "n8n" || selectedPlatform === "activepieces") ? (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-gray-900">Instance URL{selectedPlatform === "activepieces" ? " (optional)" : ""}</label>
                          <input
                            value={instanceUrl}
                            onChange={(e) => setInstanceUrl(e.target.value)}
                            type="url"
                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="https://your-instance..."
                          />
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                        Webhook-only mode will create a connection, but you'll need to send events manually.
                      </div>
                    </>
                  ) : null}

                  {selectedMethod === "mcp" ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">MCP Server URL *</label>
                        <input
                          value={mcpUrl}
                          onChange={(e) => setMcpUrl(e.target.value)}
                          type="url"
                          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">Authorization header (optional)</label>
                        <input
                          value={authHeader}
                          onChange={(e) => setAuthHeader(e.target.value)}
                          type="text"
                          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          placeholder="Bearer ..."
                        />
                      </div>
                    </>
                  ) : null}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">Connection name (optional)</label>
                    <input
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                      type="text"
                      className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Production"
                    />
                  </div>
                </div>
              ) : null}

              


              {step === "success" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Connected. Workflows will be imported automatically.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeConnect}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                disabled={saving}
              >
                Cancel
              </button>

              {step === "credentials" ? (
                <button
                  type="button"
                  onClick={createConnection}
                  disabled={saving}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {saving ? "Connecting..." : "Connect"}
                </button>
              ) : null}


              {step === "success" ? (
                <button
                  type="button"
                  onClick={() => {
                    closeConnect();
                    refreshSources();
                  }}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                >
                  Done
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Manage Workflows Modal */}
      {manageOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-gray-900">Manage Workflows</div>
                  <div className="mt-1 text-sm text-gray-600">View your n8n workflow catalog.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setManageOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              {manageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : manageError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="text-sm text-red-700">{manageError}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {manageEntities.length === 0 ? (
                    <div className="text-sm text-gray-600">No workflows found.</div>
                  ) : (
                    manageEntities.map((entity) => (
                      <div key={entity.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{entity.display_name}</div>
                          <div className="text-xs text-gray-600">ID: {entity.external_id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entity.enabled_for_analytics && (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                              Analytics
                            </span>
                          )}
                          {entity.enabled_for_actions && (
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                              Actions
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}