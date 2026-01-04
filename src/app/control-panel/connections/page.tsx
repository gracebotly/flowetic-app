
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyRound,
  Webhook as WebhookIcon,
  Bot,
  MoreVertical,
  Eye,
  Settings,
  Edit,
  Trash2,
  Search as SearchIcon,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  N8nLogo,
  MakeLogo,
  ActivepiecesLogo,
  VapiLogo,
  RetellLogo,
} from "@/components/connections/platform-icons";

type EntityType = "workflow" | "agent" | "voice_agent" | "automation";

type IndexedEntity = {
  id: string;
  name: string;
  platform: string;
  type: EntityType;
  last_seen_at: string; // display string (server can return formatted)
  created_at: string; // display string (server can return formatted)
  created_at_ts?: number; // optional unix ms for accurate sorting
  last_updated_ts?: number; // optional unix ms for accurate sorting
  last_updated_at?: string; // optional display
  indexed?: boolean;
};

type SortKey = "created_at" | "last_updated" | "name";

type ConnectMethod = "api" | "webhook" | "mcp";

type CredentialRow = {
  id: string;
  platformType: string;
  name: string;
  status: string | null;
  method: ConnectMethod;
  created_at: string; // ISO string from Supabase
  updated_at: string; // ISO string from Supabase
};

type CredentialSort = "last_updated" | "last_created" | "name_az";

const entityTypeLabel: Record<EntityType, string> = {
  workflow: "Workflow",
  agent: "Agent",
  voice_agent: "Voice Agent",
  automation: "Automation",
};

const PLATFORM_META = {
  n8n: { label: "n8n", Icon: N8nLogo },
  make: { label: "Make", Icon: MakeLogo },
  activepieces: { label: "Activepieces", Icon: ActivepiecesLogo },
  vapi: { label: "Vapi", Icon: VapiLogo },
  retell: { label: "Retell", Icon: RetellLogo },
};

type PlatformKey = keyof typeof PLATFORM_META;

const PLATFORM_KEYS = Object.keys(PLATFORM_META) as PlatformKey[];

function getPlatformMeta(platformType: string) {
  const normalized = platformType.toLowerCase();
  const key = PLATFORM_KEYS.find((k) => k === normalized);
  return key ? PLATFORM_META[key] : undefined;
}

function StatusPill({ status }: { status: string | null }) {
  if (status === "active" || status === "connected") {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">Connected</span>;
  }
  if (status === "error") {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Error</span>;
  }
  if (status === "inactive") {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">Inactive</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">Attention</span>;
}

function CredentialsDropdownMenu({ sourceId, onClose }: { sourceId: string; onClose: () => void }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content side="bottom" align="end" className="z-50 min-w-[160px] rounded-md border bg-white p-1 shadow">
        <DropdownMenu.Item 
          className="rounded px-2 py-1.5 text-sm hover:bg-gray-100 cursor-pointer"
          onClick={() => {
            alert(`Configure: ${sourceId}`);
            onClose();
          }}
        >
          Configure
        </DropdownMenu.Item>
        <DropdownMenu.Item 
          className="rounded px-2 py-1.5 text-sm hover:bg-gray-100 cursor-pointer" 
          onClick={() => {
            alert(`Edit: ${sourceId}`);
            onClose();
          }}
        >
          Edit
        </DropdownMenu.Item>
        <DropdownMenu.Item 
          className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-gray-100 cursor-pointer" 
          onClick={() => {
            alert(`Delete: ${sourceId}`);
            onClose();
          }}
        >
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function KebabMenu({
  isOpen,
  onToggle,
  onClose,
  onViewDetails,
  onEdit,
  onDelete,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!isOpen) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (!menuRef.current) return;
      if (!menuRef.current.contains(t)) onClose();
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        className="text-gray-400 hover:text-gray-600"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Row actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onViewDetails();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            View Details
          </button>
          <button
            type="button"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EntityDropdownMenu({
  entityId,
  isOpen,
  onClose,
}: {
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="dropdown-menu absolute right-0 z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
      <button
        onClick={() => {
          console.log("View Details for entity", entityId);
          onClose();
        }}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Eye className="h-4 w-4" />
        View Details
      </button>

      <button
        onClick={() => {
          console.log("Edit entity", entityId);
          onClose();
        }}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Edit className="h-4 w-4" />
        Edit
      </button>

      <button
        onClick={() => {
          console.log("Delete entity", entityId);
          onClose();
        }}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}

function EntityRow({
  entity,
}: {
  entity: IndexedEntity;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
      <div className="flex items-center space-x-3">
        {(() => {
          const meta = getPlatformMeta(String(entity.platform));
          const Icon = meta?.Icon;
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
              {Icon ? <Icon className="h-5 w-5" /> : null}
            </div>
          );
        })()}
        <div>
          <div className="font-medium text-gray-900">{entity.name}</div>
          <div className="text-sm text-gray-500">
            {entityTypeLabel[entity.type] || entity.type} • {entity.platform}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-500 text-right">
          <div>Last seen: {entity.last_seen_at}</div>
          <div>Created: {entity.created_at}</div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            Indexed
          </span>

          <div className="relative">
            <button
              onClick={() => setOpenEntityDropdownId(openEntityDropdownId === entity.id ? null : entity.id)}
              className="p-1 rounded-lg hover:bg-gray-100"
            >
              <MoreVertical className="h-5 w-5 text-gray-600" />
            </button>

            <EntityDropdownMenu
              entityId={entity.id}
              isOpen={openEntityDropdownId === entity.id}
              onClose={() => setOpenEntityDropdownId(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  const [entities, setEntities] = useState<IndexedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");



  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [openEntityDropdownId, setOpenEntityDropdownId] = useState<string | null>(null);

  // Connect modal state
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<"platform" | "method" | "form">("platform");
  
  // Connect form state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"api" | "webhook" | "mcp">("api");
  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  const [connectEntities, setConnectEntities] = useState<any[]>([]);
  const [entityExternalId, setEntityExternalId] = useState("");
  const [entityDisplayName, setEntityDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  // Credentials state
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsErr, setCredentialsErr] = useState<string | null>(null);
  const [credentialsSearch, setCredentialsSearch] = useState("");
  const [credentialsSort, setCredentialsSort] = useState<CredentialSort>("last_updated");
  const [filter, setFilter] = useState<string>("all");

  async function loadEntities() {
    setLoading(true);
    setErrMsg(null);

    const res = await fetch("/api/indexed-entities/list", { method: "GET" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setEntities([]);
      setLoading(false);
      setErrMsg(json?.message || "Failed to load indexed entities.");
      return;
    }

    setEntities((json.entities as IndexedEntity[]) ?? []);
    setLoading(false);
  }

  async function refreshCredentials() {
    setCredentialsLoading(true);
    setCredentialsErr(null);

    const res = await fetch("/api/credentials/list", { method: "GET" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setCredentials([]);
      setCredentialsLoading(false);
      setCredentialsErr(json?.message || "Failed to load credentials.");
      return;
    }

    setCredentials((json.credentials as CredentialRow[]) ?? []);
    setCredentialsLoading(false);
  }

  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    if (filter === "credentials") {
      refreshCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function formatRelativeFromIso(iso: string) {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return "";
    const deltaMs = Date.now() - ts;
    const min = Math.floor(deltaMs / 60000);
    if (min < 60) return `${Math.max(min, 1)} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hours ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} days ago`;
    const wk = Math.floor(day / 7);
    return `${wk} week${wk === 1 ? "" : "s"} ago`;
  }

  function formatDateFromIso(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

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
    setConnectEntities([]);
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

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) set.add(e.platform);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entities]);

  const filteredEntities = useMemo(() => {
    let list = [...entities];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) => {
        return (
          e.name.toLowerCase().includes(q) ||
          e.platform.toLowerCase().includes(q) ||
          (entityTypeLabel[e.type] || e.type).toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "created_at") {
      list.sort((a, b) => (b.created_at_ts ?? 0) - (a.created_at_ts ?? 0));
    } else if (sortBy === "last_updated") {
      list.sort((a, b) => (b.last_updated_ts ?? 0) - (a.last_updated_ts ?? 0));
    }

    return list;
  }, [entities, platformFilter, searchQuery, sortBy, statusFilter, typeFilter]);

  const displayedCredentials = useMemo(() => {
    let rows = [...credentials];

    if (credentialsSearch.trim()) {
      const q = credentialsSearch.trim().toLowerCase();
      rows = rows.filter((c) => {
        const meta = getPlatformMeta(String(c.platformType));
        const label = meta?.label ?? c.platformType;
        return (
          c.name.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          c.platformType.toLowerCase().includes(q)
        );
      });
    }

    if (credentialsSort === "name_az") {
      rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (credentialsSort === "last_created") {
      rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    } else {
      rows.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    }

    return rows;
  }, [credentials, credentialsSearch, credentialsSort]);

  return (
    <div className="mx-auto max-w-6xl p-6">
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
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setFilter("all")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              filter === "all"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("credentials")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              filter === "credentials"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Credentials
          </button>
        </nav>
      </div>

      {/* All Entities View */}
      {filter === "all" ? (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Workflows, agents, and automations you have indexed</h2>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search workflows & agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80 rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="created_at">Sort by Created Date</option>
              <option value="last_updated">Sort by Last Updated</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          {errMsg ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errMsg}
            </div>
          ) : null}

          {loading ? <div className="text-sm text-gray-600">Loading…</div> : null}

          {!loading ? (
            <div className="space-y-2">
              {filteredEntities.map((entity) => (
                <EntityRow
                  key={entity.id}
                  entity={entity}
                />
              ))}
              {filteredEntities.length === 0 ? (
                <div className="rounded-lg border bg-white p-8 text-sm text-gray-600">
                  No results. Try a different search or filter.
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {/* Credentials View */}
      {filter === "credentials" ? (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="relative w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search credentials..."
                value={credentialsSearch}
                onChange={(e) => setCredentialsSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={credentialsSort}
              onChange={(e) => setCredentialsSort(e.target.value as CredentialSort)}
              className="min-w-[200px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <option value="last_updated">Sort by last updated</option>
              <option value="last_created">Sort by last created</option>
              <option value="name_az">Sort by name (A-Z)</option>
            </select>
          </div>

          {credentialsErr ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {credentialsErr}
            </div>
          ) : null}

          {credentialsLoading ? (
            <div className="mt-8 text-sm text-gray-600">Loading credentials…</div>
          ) : null}

          {!credentialsLoading ? (
            <div className="mt-6 space-y-3">
              {displayedCredentials.map((c) => {
                const meta = getPlatformMeta(String(c.platformType));
                const Icon = meta?.Icon;

                const methodLabel = c.method === "api" ? "API" : c.method === "webhook" ? "Webhook" : "MCP";
                const methodIcon =
                  c.method === "api" ? (
                    <KeyRound className="h-3.5 w-3.5" />
                  ) : c.method === "webhook" ? (
                    <WebhookIcon className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  );

                return (
                  <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                          {Icon ? <Icon className="h-5 w-5" /> : null}
                        </div>

                        <div>
                          <div className="font-semibold text-gray-900">{meta?.label ?? c.name}</div>
                          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              {methodIcon}
                              <span>{methodLabel}</span>
                            </span>

                            <span className="text-gray-300">|</span>
                            <span>Last updated {formatRelativeFromIso(c.updated_at)}</span>

                            <span className="text-gray-300">|</span>
                            <span>Created {formatDateFromIso(c.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusPill status={c.status} />
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === c.id ? null : c.id)}
                            className="p-1 rounded-lg hover:bg-gray-100"
                          >
                            <MoreVertical className="h-5 w-5 text-gray-600" />
                          </button>
                          {openDropdownId === c.id && (
                            <CredentialsDropdownMenu sourceId={c.id} onClose={() => setOpenDropdownId(null)} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {displayedCredentials.length === 0 ? (
                <div className="rounded-lg border bg-white p-8 text-sm text-gray-600">
                  No credentials found.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Connect Platform Modal (in-page) */}
      {connectOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-gray-900">
                    {step === "platform"
                      ? "Connect Platform"
                      : step === "method"
                      ? `Connect ${selectedPlatform ? getPlatformMeta(selectedPlatform).label : ""}`
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

              {/* Modal step content will go here */}
              <div className="text-center py-8">
                <div className="text-gray-600">
                  {step === "platform" && "Platform selection coming soon..."}
                  {step === "method" && "Method selection coming soon..."}
                  {step === "credentials" && "Credentials form coming soon..."}
                  {step === "entities" && "Entity selection coming soon..."}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
