
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
  PlusCircle,
  X,
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

type IndexedEntityRow = {
  id: string;
  name: string;
  platform: string;
  kind: "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";
  externalId: string;
  sourceId: string;
  lastSeenAt: string | null;
  createdAt: string;
  createdAtTs: number;
  lastUpdatedTs: number;
};

type AllSort = "created_at" | "last_updated" | "name_az";

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

type EntityDraft = {
  externalId: string;
  displayName: string;
  entityKind: "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";
  enabledForAnalytics: boolean;
  enabledForActions: boolean;
};

const entityTypeLabel: Record<EntityType, string> = {
  workflow: "Workflow",
  agent: "Agent",
  voice_agent: "Voice Agent",
  automation: "Automation",
};

const PLATFORM_META = {
  n8n: { 
    label: "n8n", 
    Icon: N8nLogo,
    description: "Workflow automation platform"
  },
  make: { 
    label: "Make", 
    Icon: MakeLogo,
    description: "Visual automation builder"
  },
  activepieces: { 
    label: "Activepieces", 
    Icon: ActivepiecesLogo,
    description: "Open-source automation tool"
  },
  vapi: { 
    label: "Vapi", 
    Icon: VapiLogo,
    description: "Voice AI platform"
  },
  retell: { 
    label: "Retell", 
    Icon: RetellLogo,
    description: "Voice agent platform"
  },
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
  openEntityDropdownId,
  setOpenEntityDropdownId,
}: {
  entity: IndexedEntity;
  openEntityDropdownId: string | null;
  setOpenEntityDropdownId: (id: string | null) => void;
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
  // Main data states
  const [entities, setEntities] = useState<IndexedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // UI state for All tab
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");

  // Tab state (for switching between All, Credentials)
  const [filter, setFilter] = useState<string>("all");

  // Dropdown states
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [openEntityDropdownId, setOpenEntityDropdownId] = useState<string | null>(null);

  // Connect modal state
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<"platform" | "method" | "credentials" | "entities" | "success">("platform");
  const [mcpHelpOpen, setMcpHelpOpen] = useState(false);
  
  // Connect form state
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PLATFORM_META | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"api" | "webhook" | "mcp">("api");
  const [n8nAuthMode, setN8nAuthMode] = useState<"header" | "bearer">("bearer");
  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpAccessToken, setMcpAccessToken] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  const [connectEntities, setConnectEntities] = useState<EntityDraft[]>([]);
  const [entityKind, setEntityKind] = useState<EntityDraft["entityKind"]>("workflow");
  const [entityExternalId, setEntityExternalId] = useState("");
  const [entityDisplayName, setEntityDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  // Credentials state
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsErr, setCredentialsErr] = useState<string | null>(null);
  const [credentialsSearch, setCredentialsSearch] = useState("");
  const [credentialsSort, setCredentialsSort] = useState<CredentialSort>("last_updated");

  // All tab entity states
  const [indexedEntities, setIndexedEntities] = useState<IndexedEntityRow[]>([]);
  const [indexedLoading, setIndexedLoading] = useState(false);
  const [indexedErr, setIndexedErr] = useState<string | null>(null);

  const [allSearch, setAllSearch] = useState("");
  const [allSort, setAllSort] = useState<AllSort>("created_at");

  const [openEntityMenuId, setOpenEntityMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<IndexedEntityRow | null>(null);

  // Inventory state for n8n workflows
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryErr, setInventoryErr] = useState<string | null>(null);
  const [inventoryEntities, setInventoryEntities] = useState<Array<{ externalId: string; displayName: string; entityKind: string; createdAt?: string | null; updatedAt?: string | null }>>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySort, setInventorySort] = useState<"updated_desc" | "created_desc" | "name_az">("updated_desc");
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());

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

  async function refreshIndexedEntities() {
    setIndexedLoading(true);
    setIndexedErr(null);

    const res = await fetch("/api/indexed-entities/list", { method: "GET" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setIndexedEntities([]);
      setIndexedLoading(false);
      setIndexedErr(json?.message || "Failed to load indexed items.");
      return;
    }

    setIndexedEntities((json.entities as IndexedEntityRow[]) ?? []);
    setIndexedLoading(false);
  }

  async function loadN8nInventory(sourceId: string) {
    setInventoryLoading(true);
    setInventoryErr(null);

    // 1) Import from n8n into source_entities
    const importRes = await fetch("/api/connections/inventory/n8n/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    const importJson = await importRes.json().catch(() => ({}));
    if (!importRes.ok || !importJson?.ok) {
      setInventoryLoading(false);
      setInventoryEntities([]);
      setInventoryErr(importJson?.message || "Failed to import workflows from n8n.");
      return;
    }

    // 2) List imported entities
    const listRes = await fetch(`/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`, { method: "GET" });
    const listJson = await listRes.json().catch(() => ({}));
    if (!listRes.ok || !listJson?.ok) {
      setInventoryLoading(false);
      setInventoryEntities([]);
      setInventoryErr(listJson?.message || "Failed to load workflows.");
      return;
    }

    setInventoryEntities((listJson.entities as any[]) ?? []);
    setSelectedExternalIds(new Set());
    setInventoryLoading(false);
  }

  useEffect(() => {
    refreshIndexedEntities();
    loadEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (filter === "credentials") {
      refreshCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest('[data-entity-menu]')) {
        setOpenEntityMenuId(null);
        setDeleteConfirmId(null);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  function formatRelativeFromTs(ts: number) {
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

  function formatDateFromTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }

  const displayedInventory = useMemo(() => {
    let rows = [...inventoryEntities];

    if (inventorySearch.trim()) {
      const q = inventorySearch.trim().toLowerCase();
      rows = rows.filter((e: any) => {
        return (
          String(e.displayName ?? "").toLowerCase().includes(q) ||
          String(e.externalId ?? "").toLowerCase().includes(q)
        );
      });
    }

    if (inventorySort === "name_az") {
      rows.sort((a: any, b: any) => String(a.displayName ?? "").localeCompare(String(b.displayName ?? "")));
    } else if (inventorySort === "created_desc") {
      rows.sort((a: any, b: any) => Date.parse(String(b.createdAt ?? "")) - Date.parse(String(a.createdAt ?? "")));
    } else {
      rows.sort((a: any, b: any) => Date.parse(String(b.updatedAt ?? "")) - Date.parse(String(a.updatedAt ?? "")));
    }

    return rows;
  }, [inventoryEntities, inventorySearch, inventorySort]);

  function resetModal() {
    setStep("platform");
    setSelectedPlatform(null);
    setSelectedMethod("api");
    setN8nAuthMode("bearer");
    setApiKey("");
    setInstanceUrl("");
    setMcpUrl("");
    setMcpAccessToken("");
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
      if (selectedPlatform === "n8n" && selectedMethod === "api") {
        if (!apiKey.trim()) {
          setSaving(false);
          setErrMsg("API Key is required.");
          return;
        }
        if (!instanceUrl.trim()) {
          setSaving(false);
          setErrMsg("Instance URL is required for n8n API connections.");
          return;
        }
      }
      
      payload.apiKey = apiKey;

      if (instanceUrl) payload.instanceUrl = instanceUrl;

      // n8n on your instance requires X-N8N-API-KEY header (no UI dropdown)
      if (selectedPlatform === "n8n") {
        payload.n8nAuthMode = "header";
      }
    }

    if (selectedMethod === "webhook") {
      if (instanceUrl) payload.instanceUrl = instanceUrl;
    }

    if (selectedMethod === "mcp") {
      if (selectedPlatform === "n8n" && selectedMethod === "mcp") {
        if (!instanceUrl.trim()) {
          setSaving(false);
          setErrMsg("Server URL is required for n8n MCP connections.");
          return;
        }
        if (!mcpAccessToken.trim()) {
          setSaving(false);
          setErrMsg("Access token is required.");
          return;
        }
      }
      
      if (selectedPlatform === "n8n") {
        // Use instanceUrl and mcpAccessToken from n8n MCP form
        payload.mcpUrl = instanceUrl.trim();
        payload.authHeader = `Bearer ${mcpAccessToken.trim()}`;
      } else {
        // Use mcpUrl and authHeader for other platforms
        payload.mcpUrl = mcpUrl;
        if (authHeader) payload.authHeader = authHeader;
      }
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
    setStep("entities");
    
    if (selectedPlatform === "n8n" && selectedMethod === "api") {
      await loadN8nInventory(sourceId);
    }
    
    setSaving(false);
  }

  function addEntityDraft() {
    const ext = entityExternalId.trim();
    const name = entityDisplayName.trim();
    if (!ext || !name) return;

    setConnectEntities((prev) => [
      ...prev,
      {
        externalId: ext,
        displayName: name,
        entityKind,
        enabledForAnalytics: true,
        enabledForActions: selectedMethod === "mcp",
      },
    ]);

    setEntityExternalId("");
    setEntityDisplayName("");
  }

  function removeEntityDraft(idx: number) {
    setConnectEntities((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveEntitiesSelection() {
    if (!createdSourceId) return;

    if (connectEntities.length === 0) {
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
        entities: connectEntities,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setSaving(false);
      setErrMsg(json?.message || "Failed to save entities.");
      return;
    }

    setSaving(false);
    setStep("success");
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
  }, [entities, searchQuery, sortBy]);

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

  const displayedIndexedEntities = useMemo(() => {
    let rows = [...indexedEntities];

    if (allSearch.trim()) {
      const q = allSearch.trim().toLowerCase();
      rows = rows.filter((e) => {
        return (
          e.name.toLowerCase().includes(q) ||
          e.platform.toLowerCase().includes(q) ||
          e.kind.toLowerCase().includes(q)
        );
      });
    }

    if (allSort === "name_az") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else if (allSort === "last_updated") {
      rows.sort((a, b) => b.lastUpdatedTs - a.lastUpdatedTs);
    } else {
      rows.sort((a, b) => b.createdAtTs - a.createdAtTs);
    }

    return rows;
  }, [indexedEntities, allSearch, allSort]);

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
          

          <div className="mt-6 flex items-center justify-between">
            <div className="relative w-[400px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={allSearch}
                onChange={(e) => setAllSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search workflows & agents..."
              />
            </div>

            <select
              value={allSort}
              onChange={(e) => setAllSort(e.target.value as AllSort)}
              className="min-w-[200px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
            >
              <option value="created_at">Sort by Created Date</option>
              <option value="last_updated">Sort by Last Updated</option>
              <option value="name_az">Sort by Name (A-Z)</option>
            </select>
          </div>

        <div className="mt-6">
          {indexedErr ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{indexedErr}</div>
          ) : null}

          {indexedLoading ? <div className="mt-6 text-sm text-gray-600">Loading…</div> : null}

          {!indexedLoading ? (
            <div className="mt-6 space-y-3">
              {displayedIndexedEntities.map((entity) => {
                const meta = getPlatformMeta(entity.platform);
                const Icon = meta?.Icon;

                return (
                  <div key={entity.id} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                          {Icon ? <Icon className="h-5 w-5" /> : null}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900">{entity.name}</div>
                          <div className="text-sm text-gray-600">
                            {entity.kind} • {meta?.label ?? entity.platform}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm text-gray-500">
                          <div>Last seen: {formatRelativeFromTs(entity.lastUpdatedTs)}</div>
                          <div>Created: {formatDateFromTs(entity.createdAtTs)}</div>
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmId(null);
                              setOpenEntityMenuId(openEntityMenuId === entity.id ? null : entity.id);
                            }}
                            className="rounded-lg p-2 hover:bg-gray-100"
                            aria-label="Row actions"
                          >
                            <MoreVertical className="h-5 w-5 text-gray-600" />
                          </button>

                          {openEntityMenuId === entity.id ? (
                            <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-gray-200 bg-white shadow-lg" data-entity-menu>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEntity(entity);
                                  setDetailsOpen(true);
                                  setOpenEntityMenuId(null);
                                  setDeleteConfirmId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4" />
                                View details
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (deleteConfirmId !== entity.id) {
                                    setDeleteConfirmId(entity.id);
                                    return;
                                  }

                                  // TODO (later): wire to real remove-from-index endpoint.
                                  // For now: close menu and refresh list.
                                  setOpenEntityMenuId(null);
                                  setDeleteConfirmId(null);
                                  refreshIndexedEntities();
                                }}
                                className={
                                  "flex w-full items-start gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 " +
                                  (deleteConfirmId === entity.id ? "bg-red-100" : "")
                                }
                              >
                                <Trash2 className="mt-0.5 h-4 w-4" />
                                <span className="leading-tight">
                                  {deleteConfirmId === entity.id ? (
                                    <>
                                      <span className="font-semibold">Confirm delete</span>
                                      <span className="mt-0.5 block text-xs font-normal text-red-500">
                                        Removes from index. You can add it back later.
                                      </span>
                                    </>
                                  ) : (
                                    "Delete"
                                  )}
                                </span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {displayedIndexedEntities.length === 0 ? (
                <div className="rounded-lg border bg-white p-8 text-sm text-gray-600">No results.</div>
              ) : null}
            </div>
          ) : null}
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-semibold text-gray-900">
                      {step === "platform"
                        ? "Connect Platform"
                        : step === "method"
                        ? `Connect ${selectedPlatform ? (getPlatformMeta(String(selectedPlatform))?.label ?? String(selectedPlatform)) : ""}`
                        : step === "credentials"
                        ? `Credentials`
                        : step === "entities"
                        ? "Select entities to index"
                        : "Connected"}
                    </div>
                    {step === "credentials" && selectedPlatform === "n8n" && selectedMethod === "mcp" ? (
                      <button
                        type="button"
                        onClick={() => setMcpHelpOpen(true)}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        What is this?
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {step === "platform"
                      ? "Choose which platform you want to connect."
                      : step === "method"
                      ? "Choose a connection method."
                      : step === "credentials"
                      ? selectedPlatform === "n8n" && selectedMethod === "mcp"
                        ? "Enter the Server URL and Access token from n8n's Instance-level MCP settings."
                        : "Enter credentials to validate and connect."
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
              {step === "platform" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(PLATFORM_META) as Array<keyof typeof PLATFORM_META>).map((k) => {
                      const meta = PLATFORM_META[k];
                      const Icon = meta.Icon;

                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setSelectedPlatform(k);
                            setErrMsg(null);
                            setStep("method");
                          }}
                          className="w-full rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-base font-semibold text-gray-900">{meta.label}</div>
                              <div className="text-sm text-gray-600">{meta.description}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
        Connect to your n8n instance using an API key to import and index workflows.
      </div>
    </button>

    {selectedPlatform !== "n8n" ? (
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
        <div className="mt-1 text-sm text-gray-700">Manual event streaming to GetFlowetic. No catalog import.</div>
        <div className="mt-2 text-xs text-gray-600">
          Best for voice platforms if you want real-time events. Automation platforms generally rely on API polling.
        </div>
      </button>
    ) : null}

    {selectedPlatform ? (
      <button
        type="button"
        onClick={() => {
          // MCP support in your current PLATFORM_META is not tracked; allow for automation platforms only
          if (!["n8n", "make", "activepieces"].includes(String(selectedPlatform))) {
            setErrMsg("MCP is only supported for n8n, Make, and Activepieces.");
            return;
          }
          setSelectedMethod("mcp");
          setErrMsg(null);
          setStep("credentials");
        }}
        className="w-full rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Bot className="h-5 w-5 text-slate-700" />
          MCP instances
        </div>
        <div className="mt-1 text-sm text-gray-700">
          Connect to n8n's built-in MCP server to discover and run workflows enabled for MCP.
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

    {(selectedPlatform === "n8n" || selectedPlatform === "activepieces") && selectedMethod !== "mcp" ? (
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">
          {selectedPlatform === "n8n" && selectedMethod === "api" ? "Instance URL *" : "Instance URL (optional)"}
        </label>
        <input
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          type="url"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="https://your-instance..."
        />
        {selectedPlatform === "n8n" && selectedMethod === "api" ? (
          <div className="mt-1 text-xs text-gray-600">
            Used to validate your key against your n8n instance.
          </div>
        ) : null}
      </div>
    ) : null}

    {selectedMethod === "webhook" ? (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Webhook-only mode will create a connection, but you'll need to send events manually.
      </div>
    ) : null}

    {selectedMethod === "mcp" ? (
      <>
        {selectedPlatform === "n8n" ? (
          <>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Server URL *</label>
              <input
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                type="url"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="https://your-instance..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Access token *</label>
              <input
                value={mcpAccessToken}
                onChange={(e) => setMcpAccessToken(e.target.value)}
                type="password"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="••••••••••••••"
              />
              <div className="mt-1 text-xs text-gray-600">
                From n8n: Instance-level MCP &rarr; Access token.
              </div>
            </div>
          </>
        ) : (
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
        )}
      </>
    ) : null}

    {selectedPlatform !== "n8n" ? (
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
    ) : null}

    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={() => {
          setStep("method");
          setErrMsg(null);
        }}
        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        disabled={saving}
      >
        Back
      </button>
      <button
        type="button"
        onClick={createConnection}
        disabled={saving}
        className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? "Connecting..." : "Connect"}
      </button>
    </div>
  </div>
) : null}
{step === "entities" ? (
  <div className="space-y-4">
    <div className="text-sm text-gray-700">
      Select the workflows you want GetFlowetic to index.
    </div>

    {inventoryErr ? (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inventoryErr}</div>
    ) : null}

    {inventoryLoading ? (
      <div className="text-sm text-gray-600">Loading workflows…</div>
    ) : null}

    {!inventoryLoading ? (
      <>
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-[420px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search workflows..."
          />
        </div>

        <select
          value={inventorySort}
          onChange={(e) => setInventorySort(e.target.value as any)}
          className="min-w-[220px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          <option value="updated_desc">Sort by last updated</option>
          <option value="created_desc">Sort by created date</option>
          <option value="name_az">Sort by name (A–Z)</option>
        </select>
      </div>

      <div className="max-h-[320px] overflow-auto rounded-lg border border-gray-200 mt-3">
        {inventoryEntities.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No workflows found in this n8n instance.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {displayedInventory.map((e) => {
              const checked = selectedExternalIds.has(e.externalId);
              return (
                <label key={e.externalId} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{e.displayName}</div>
                    <div className="truncate text-xs text-gray-500">ID: {e.externalId}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedExternalIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(e.externalId)) next.delete(e.externalId);
                        else next.add(e.externalId);
                        return next;
                      });
                    }}
                    className="h-4 w-4"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
      </>
    ) : null}

    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={() => setStep("credentials")}
        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        disabled={saving || inventoryLoading}
      >
        Back
      </button>

      <button
        type="button"
        onClick={async () => {
          if (!createdSourceId) return;

          const selected = inventoryEntities.filter((e) => selectedExternalIds.has(e.externalId));
          if (selected.length === 0) {
            setErrMsg("Select at least one workflow to continue.");
            return;
          }

          setSaving(true);
          setErrMsg(null);

          const res = await fetch("/api/connections/entities/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceId: createdSourceId,
              entities: selected.map((w) => ({
                externalId: w.externalId,
                displayName: w.displayName,
                entityKind: "workflow",
                enabledForAnalytics: true,
                enabledForActions: false,
              })),
            }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok) {
            setSaving(false);
            setErrMsg(json?.message || "Failed to save selection.");
            return;
          }

          setSaving(false);
          setStep("success");
        }}
        disabled={saving || inventoryLoading || selectedExternalIds.size === 0}
        className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  </div>
) : null}
{step === "success" ? (
  <div className="space-y-4">
    <div className="text-center text-sm text-gray-700">
      Connection configuration saved successfully.
    </div>

    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={() => {
          // Close modal
          closeConnect();
          // Refetch connections
          refreshCredentials();
          refreshIndexedEntities();
        }}
        className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
      >
        Done
      </button>
    </div>
  </div>
) : null}
            </div>
          </div>
        </div>
      ) : null}

      {detailsOpen && selectedEntity ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                    {getPlatformMeta(selectedEntity.platform)?.Icon ? (
                      (() => {
                        const Icon = getPlatformMeta(selectedEntity.platform)?.Icon!;
                        return <Icon className="h-5 w-5" />;
                      })()
                    ) : null}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{selectedEntity.name}</div>
                    <div className="text-sm text-gray-600">
                      {selectedEntity.kind} • {getPlatformMeta(selectedEntity.platform)?.label ?? selectedEntity.platform}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div>
                <button
                  type="button"
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  // NOTE: no wiring to VibeChat yet as requested
                  onClick={() => {
                    console.log("Build dashboard in Chat (TODO):", selectedEntity);
                    setDetailsOpen(false);
                  }}
                >
                  Build dashboard in Chat
                </button>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Opens VibeChat with this agent pre-loaded so you can design its UI.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Index status</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm font-semibold text-gray-900">Indexed</span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dashboard</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Not created</div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client access</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Not shared</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-gray-500">Platform</div>
                  <div className="font-medium text-gray-900">
                    {getPlatformMeta(selectedEntity.platform)?.label ?? selectedEntity.platform}
                  </div>

                  <div className="text-gray-500">Type</div>
                  <div className="font-medium text-gray-900">{selectedEntity.kind}</div>

                  <div className="text-gray-500">External ID</div>
                  <div className="font-mono text-xs text-gray-900">{selectedEntity.externalId}</div>

                  <div className="text-gray-500">Last seen</div>
                  <div className="font-medium text-gray-900">{formatRelativeFromTs(selectedEntity.lastUpdatedTs)}</div>

                  <div className="text-gray-500">Created</div>
                  <div className="font-medium text-gray-900">{formatDateFromTs(selectedEntity.createdAtTs)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="border-b px-4 py-3">
                  <div className="text-sm font-semibold text-gray-900">Dashboards</div>
                  <div className="text-xs text-gray-500">Dashboards created from this agent/workflow</div>
                </div>
                <div className="p-4 text-sm text-gray-500">
                  No dashboards yet. Click &quot;Build dashboard in Chat&quot; to create one.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* MCP Help Modal */}
      {mcpHelpOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="text-lg font-semibold text-gray-900">About n8n MCP instances</div>
                <button
                  type="button"
                  onClick={() => setMcpHelpOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-4 text-sm text-gray-700">
              <p>
                MCP lets AI tools discover and run workflows you explicitly enable in your n8n instance.
              </p>

              <ul className="list-disc pl-5 space-y-2">
                <li>Workflows are created and edited in n8n — MCP cannot author workflows.</li>
                <li>No workflows are exposed by default. You must enable MCP per workflow.</li>
                <li>MCP access is instance-wide. All connected MCP clients see enabled workflows.</li>
                <li>Only published workflows with supported triggers are eligible.</li>
                <li>MCP-triggered workflows run normally and appear in n8n executions.</li>
              </ul>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                For full setup steps, limits, and revoking access, read{" "}
                <a
                  href="https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-600"
                >
                  n8n's official MCP server guide
                </a>
                .
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setMcpHelpOpen(false)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
