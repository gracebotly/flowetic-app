
"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Webhook as WebhookIcon, Bot, MoreVertical, Eye, Settings, Edit, Trash2 } from "lucide-react";
import { ActivepiecesLogo, MakeLogo, N8nLogo, RetellLogo, VapiLogo } from "@/components/connections/platform-icons";

type Source = {
  id: string;
  type: string; // platform key, e.g. "n8n"
  name: string;
  status: string | null;
  // optional fields returned by API (do not assume they exist)
  method?: "api" | "webhook" | "mcp";
  updatedAt?: string;
  createdAt?: string;
};

type FilterKey = "all" | "credentials";

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

function statusBucket(status: string | null): "connected" | "attention" | "error" | "available" {
  if (!status || status === "active") return "connected";
  if (status === "error") return "error";
  if (status === "inactive") return "available";
  return "attention";
}

function StatusPill({ status }: { status: string | null }) {
  const bucket = statusBucket(status);
  const text =
    bucket === "connected"
      ? "Connected"
      : bucket === "available"
      ? "Connected • Not indexing"
      : bucket === "error"
      ? "Error"
      : "Attention needed";

  const styles =
    bucket === "connected"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : bucket === "available"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : bucket === "error"
      ? "bg-red-50 text-red-700 border-red-200"
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
  const [step, setStep] = useState<"platform" | "method" | "credentials" | "entities" | "success">("platform");
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

  // entity selection drafts (manual placeholder)
  const [entities, setEntities] = useState<EntityDraft[]>([]);
  const [entityExternalId, setEntityExternalId] = useState("");
  const [entityDisplayName, setEntityDisplayName] = useState("");
  const [entityKind, setEntityKind] = useState<EntityDraft["entityKind"]>("workflow");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Search and sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"lastUpdated" | "name" | "type">("lastUpdated");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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
  }

  useEffect(() => {
    refreshSources();
  }, []);

  const filteredSources = useMemo(() => {
    let filtered = sources;

    // Tab filtering
    if (filter === "credentials") {
      // Credentials tab should show only credential connections (API/Webhook/MCP).
      // If the API returns a "method" field, use it. Otherwise, fall back to showing all connected sources
      // (but this fallback should be replaced once the API includes method).
      filtered = sources.filter((s) => {
        const m = s.method;
        if (m) return m === "api" || m === "webhook" || m === "mcp";
        // Fallback: if method missing, at least ensure the source is "connected-ish"
        // so we don't show random/unconnected items. This prevents "All == Credentials".
        return Boolean(s.status);
      });
    }

    // Search filtering
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((s) => {
        const platform = PLATFORM_META[String(s.type)];
        return (
          s.name.toLowerCase().includes(q) ||
          platform?.label.toLowerCase().includes(q) ||
          platform?.description.toLowerCase().includes(q)
        );
      });
    }

    // Sorting
    const sortKey = sortBy;
    filtered = [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "type") return String(a.type).localeCompare(String(b.type));
      // lastUpdated (default)
      const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return bTime - aTime;
    });

    return filtered;
  }, [sources, filter, searchTerm, sortBy]);

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
    setEntities([]);
    setEntityExternalId("");
    setEntityDisplayName("");
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
    }
    if (selectedMethod === "webhook") {
      if (instanceUrl) payload.instanceUrl = instanceUrl;
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

    // Next step is entity selection (manual placeholder)
    setStep("entities");
    setSaving(false);

    // refresh cards in background
    refreshSources();
  }

  function addEntityDraft() {
    const ext = entityExternalId.trim();
    const name = entityDisplayName.trim();
    if (!ext || !name) return;

    setEntities((prev) => [
      ...prev,
      {
        externalId: ext,
        displayName: name,
        entityKind,
        enabledForAnalytics: true,
        enabledForActions: selectedMethod === "mcp", // default: actions on if MCP
      },
    ]);
    setEntityExternalId("");
    setEntityDisplayName("");
  }

  function removeEntityDraft(idx: number) {
    setEntities((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveEntitiesSelection() {
    if (!createdSourceId) return;
    if (entities.length === 0) {
      setErrMsg("Add at least one entity to index (workflow/agent/etc.).");
      return;
    }

    setSaving(true);
    setErrMsg(null);

    const res = await fetch("/api/connections/entities/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: createdSourceId,
        entities: entities.map((e) => ({
          entityKind: e.entityKind,
          externalId: e.externalId,
          displayName: e.displayName,
          enabledForAnalytics: e.enabledForAnalytics,
          enabledForActions: e.enabledForActions,
        })),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setSaving(false);
      setErrMsg(json?.message || "Failed to save entity selection.");
      return;
    }

    setSaving(false);
    setStep("success");
  }

  // N8n workflow catalog fetch
  const fetchN8nWorkflows = async (apiKey: string, instanceUrl: string) => {
    try {
      const res = await fetch(`${instanceUrl}/workflows`, {
        method: "GET",
        headers: {
          "X-N8N-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch workflows");
      }
      
      const workflows = await res.json();
      return workflows.map((wf: any) => ({
        externalId: wf.id,
        displayName: wf.name,
        entityKind: "workflow" as const,
      }));
    } catch (error) {
      console.error("Error fetching n8n workflows:", error);
      return [];
    }
  };

  // Dropdown menu component
  const DropdownMenu = ({ sourceId, onClose }: { sourceId: string; onClose: () => void }) => {
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (event.target instanceof Element && !event.target.closest('.dropdown-menu')) {
          setIsOpen(false);
          onClose();
        }
      };

      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }, [onClose]);

    if (!isOpen) return null;

    return (
      <div className="dropdown-menu absolute right-0 z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
        <button
          onClick={() => {
            // View Details
            console.log("View Details for", sourceId);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Eye className="h-4 w-4" />
          View Details
        </button>
        <button
          onClick={() => {
            // Configure
            console.log("Configure for", sourceId);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Settings className="h-4 w-4" />
          Configure
        </button>
        <button
          onClick={() => {
            // Edit
            console.log("Edit for", sourceId);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Edit className="h-4 w-4" />
          Edit
        </button>
        <button
          onClick={() => {
            // Delete
            console.log("Delete for", sourceId);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="px-8 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Connections</h1>
            <p className="mt-1 text-sm text-gray-600">
              All the workflows, agents and credentials you have access to
            </p>
          </div>

          <button
            type="button"
            onClick={openConnect}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Connect Platform
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2">
          {([
            ["all", "All"],
            ["credentials", "Credentials"],
          ] as Array<[FilterKey, string]>).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={
                filter === k
                  ? "rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search and controls */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search credentials..."
                className="w-64 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="lastUpdated">Sort by last updated</option>
              <option value="name">Sort by name</option>
              <option value="type">Sort by type</option>
            </select>
            <button
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
              className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm hover:border-blue-500"
            >
              {viewMode === "list" ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              )}
            </button>
          </div>
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

        {/* List view */}
        {!loading && sources.length > 0 ? (
          <div className="mt-8">
            {filter === "all" ? (
              <div className="space-y-3">
                {filteredSources.map((s) => {
                  const meta = PLATFORM_META[String(s.type)];
                  const Icon = meta?.Icon;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                          {Icon ? <Icon className="h-6 w-6" /> : null}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{meta?.label ?? s.type}</div>
                          <div className="text-sm text-gray-600">{meta?.description ?? ""}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusPill status={s.status} />
                        {/* keep your existing 3-dot dropdown trigger here */}
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId(openDropdownId === s.id ? null : s.id)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                          aria-label="Open menu"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openDropdownId === s.id && (
                          <DropdownMenu 
                            sourceId={s.id} 
                            onClose={() => setOpenDropdownId(null)} 
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSources.map((s) => {
                  const meta = PLATFORM_META[String(s.type)];
                  const Icon = meta?.Icon;
                  const methodLabel =
                    s.method === "api" ? "API" : s.method === "webhook" ? "Webhook" : s.method === "mcp" ? "MCP" : "Credential";
                  const methodIcon =
                    s.method === "api" ? <KeyRound className="h-4 w-4 text-emerald-700" /> : s.method === "webhook" ? (
                      <WebhookIcon className="h-4 w-4 text-amber-800" />
                    ) : (
                      <Bot className="h-4 w-4 text-fuchsia-800" />
                    );

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                          {Icon ? <Icon className="h-6 w-6" /> : null}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                          <div className="text-sm text-gray-600">{meta?.label ?? s.type}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          {methodIcon}
                          {methodLabel}
                        </span>

                        <StatusPill status={s.status} />

                        {/* keep your existing 3-dot dropdown trigger here */}
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId(openDropdownId === s.id ? null : s.id)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                          aria-label="Open menu"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openDropdownId === s.id && (
                          <DropdownMenu 
                            sourceId={s.id} 
                            onClose={() => setOpenDropdownId(null)} 
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                      : step === "entities"
                      ? "Select entities to index"
                      : "Connected"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {step === "platform"
                      ? "Choose which platform you want to connect."
                      : step === "method"
                      ? "Choose a connection method."
                      : step === "credentials"
                      ? "Enter credentials to validate and connect."
                      : step === "entities"
                      ? "Add agents/workflows you want GetFlowetic to index."
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
                    else if (step === "entities") setStep("credentials");
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
                          // default kind
                          setEntityKind(PLATFORM_META[k].category === "voice_ai" ? "agent" : "workflow");
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
                      Connect via API to import your catalog so you can select what to index for dashboards.
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
                      Manual event streaming to GetFlowetic. No catalog import.
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
                        Optional. Enables AI-triggered workflow actions. Does not replace analytics ingestion.
                      </div>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {step === "credentials" ? (
                <div className="space-y-4">
                  {selectedMethod === "api" ? (
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
                  ) : null}

                  {(selectedPlatform === "n8n" || selectedPlatform === "activepieces") ? (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Instance URL (optional)</label>
                      <input
                        value={instanceUrl}
                        onChange={(e) => setInstanceUrl(e.target.value)}
                        type="url"
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="https://your-instance..."
                      />
                    </div>
                  ) : null}

                  {selectedMethod === "webhook" ? (
                    <>
                      {(selectedPlatform === "n8n" || selectedPlatform === "activepieces") ? (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-gray-900">Instance URL (optional)</label>
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

              {step === "entities" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                    Temporary MVP: you can add entities manually. GetFlowetic will ONLY index what you add here (not your full catalog).
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="md:col-span-1">
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Kind</label>
                      <select
                        value={entityKind}
                        onChange={(e) => setEntityKind(e.target.value as any)}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="workflow">workflow</option>
                        <option value="scenario">scenario</option>
                        <option value="flow">flow</option>
                        <option value="agent">agent</option>
                        <option value="assistant">assistant</option>
                        <option value="squad">squad</option>
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="mb-2 block text-sm font-semibold text-gray-900">External ID</label>
                      <input
                        value={entityExternalId}
                        onChange={(e) => setEntityExternalId(e.target.value)}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="agent_123 / workflowId..."
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Display name</label>
                      <input
                        value={entityDisplayName}
                        onChange={(e) => setEntityDisplayName(e.target.value)}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Sales Agent"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addEntityDraft}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                  >
                    Add entity
                  </button>

                  <div className="space-y-2">
                    {entities.length === 0 ? (
                      <div className="text-sm text-gray-600">No entities added yet.</div>
                    ) : null}

                    {entities.map((e, idx) => (
                      <div key={`${e.externalId}-${idx}`} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{e.displayName}</div>
                          <div className="text-xs text-gray-600">
                            {e.entityKind} • {e.externalId}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntityDraft(idx)}
                          className="rounded-md bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === "success" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Connection created and indexing selection saved. You can now use Vibe and it will be aware of your configured entities.
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

              {step === "entities" ? (
                <button
                  type="button"
                  onClick={saveEntitiesSelection}
                  disabled={saving}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save selection"}
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
    </div>
  );
}
