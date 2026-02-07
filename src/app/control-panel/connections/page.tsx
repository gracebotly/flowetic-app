
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
  Cpu,
  Copy,
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

type ConnectMethod = "api" | "webhook";

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
  enabled_for_analytics?: boolean;
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
  instanceUrl?: string;
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

function getCredentialDeleteCopy(platformType: string) {
  const p = String(platformType || "").toLowerCase();

  const label =
    p === "n8n"
      ? "workflows"
      : p === "vapi"
        ? "assistants"
        : p === "retell"
          ? "agents"
          : "resources";

  const platformName =
    p === "n8n"
      ? "n8n"
      : p === "vapi"
        ? "Vapi"
        : p === "retell"
          ? "Retell"
          : p === "make"
            ? "Make"
            : "the external platform";

  return {
    title: "Delete credentials?",
    description: `Deleting credentials will remove GetFlowetic's access to your ${label}.`,
    warning:
      p === "n8n"
        ? "This does not delete anything in n8n. It only removes this connection from GetFlowetic."
        : `This does not delete anything in ${platformName}. It only removes this connection from GetFlowetic.`,
    confirmLabel: `I understand this will disconnect my ${label}.`,
  };
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

function CredentialsDropdownMenu({   
  sourceId,
  onClose,
  onEdit,
  onDelete 
}: { 
  sourceId: string; 
  onClose: () => void; 
  onEdit: (sourceId: string) => void; 
  onDelete: (sourceId: string) => void; 
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="bottom" align="end" className="z-50 min-w-[160px] rounded-md border bg-white p-1 shadow">
          <DropdownMenu.Item 
            className="rounded px-2 py-1.5 text-sm hover:bg-gray-100 cursor-pointer"
            onClick={() => {
              onEdit(sourceId);
              onClose();
            }}
          >
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item 
            className="rounded px-2 py-1.5 text-sm text-red-600 hover:bg-gray-100 cursor-pointer"
            onClick={() => {
              onDelete(sourceId);
              onClose();
            }}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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


export default function ConnectionsPage() {
  // Main data states
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [lastError, setLastError] = useState<any | null>(null);
  const [lastWarnings, setLastWarnings] = useState<any[] | null>(null);
  const [lastConnectError, setLastConnectError] = useState<any | null>(null);
  const [connectWarnings, setConnectWarnings] = useState<Array<{ code: string; message: string }>>([]);

  // Tab state (for switching between All, Credentials)
  const [filter, setFilter] = useState<string>("all");

  // Dropdown states
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [openCredentialMenuId, setOpenCredentialMenuId] = useState<string | null>(null);

  // Connect modal state
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<"platform" | "method" | "credentials" | "entities" | "success">("platform");
  const [isPostConnectSelection, setIsPostConnectSelection] = useState(false);
  
  
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [credentialDeleteId, setCredentialDeleteId] = useState<string | null>(null);
  const [credentialDeleteConfirm, setCredentialDeleteConfirm] = useState(false);
  const [credentialDeletePlatformType, setCredentialDeletePlatformType] = useState<string | null>(null);
  
  // Connect form state
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PLATFORM_META | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"api" | "webhook">("api");
  const [selectedRegion, setSelectedRegion] = useState<'us1' | 'us2' | 'eu1' | 'eu2'>('us2');
  const [n8nAuthMode, setN8nAuthMode] = useState<"header" | "bearer">("bearer");
  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [connectionName, setConnectionName] = useState("");

  
  // Edit modal state for "Saved" indicators
  const [editingMeta, setEditingMeta] = useState<{
    sourceId: string;
    platformType: string;
    method: ConnectMethod;
    name: string;
  } | null>(null);

  const [showApiKeyEditor, setShowApiKeyEditor] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [instanceUrlSaved, setInstanceUrlSaved] = useState(false);
  
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  const [connectEntities, setConnectEntities] = useState<EntityDraft[]>([]);
  const [entityKind, setEntityKind] = useState<EntityDraft["entityKind"]>("workflow");
  const [entityExternalId, setEntityExternalId] = useState("");
  const [entityDisplayName, setEntityDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectSummary, setConnectSummary] = useState<{ callsLoaded?: number } | null>(null);

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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<IndexedEntityRow | null>(null);

  // Inventory state for n8n workflows
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryErr, setInventoryErr] = useState<string | null>(null);
  const [inventoryEntities, setInventoryEntities] = useState<Array<{ externalId: string; displayName: string; entityKind: string; createdAt?: string | null; updatedAt?: string | null }>>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());

  

  function entityNoun(platform: string) {
    if (platform === "vapi") return "assistants";
    if (platform === "make") return "scenarios";
    if (platform === "retell") return "agents";
    return "workflows";
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

  async function deleteCredentialById(sourceId: string) {
    setSaving(true);
    setErrMsg(null);

    const res = await fetch("/api/credentials/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      const msg =
        typeof json?.message === "string" && json.message.trim()
          ? json.message
          : "Failed to delete credential.";
      const code =
        typeof json?.code === "string" && json.code.trim()
          ? ` (${json.code})`
          : "";
      setErrMsg(`${msg}${code}`);
      setSaving(false);
      return false;
    }

    // Close delete modal state
    setCredentialDeleteId(null);
    setCredentialDeleteConfirm(false);

    // Close menus to avoid "no buttons"/stuck UI
    setOpenCredentialMenuId(null);

    // Optimistically remove from UI immediately
    setCredentials((prev) => prev.filter((c) => c.id !== sourceId));

    // Authoritative refetch (HAR shows the app already calls this; we ensure state is set from response)
    await refreshCredentials();

    // Also refresh the "All" tab so deleted source's entities disappear
    await refreshIndexedEntities();

    setSaving(false);
    return true;
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

  async function getIndexedExternalIdsForSource(sourceId: string) {
    const res = await fetch("/api/indexed-entities/list", { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) return new Set<string>();

    const ids = ((json.entities as any[]) ?? [])
      .filter((e: any) => String(e.sourceId) === String(sourceId))
      .map((e: any) => String(e.externalId));

    return new Set<string>(ids);
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

    // 2) List imported entities (including UNINDEXED) from inventory endpoint
    const listRes = await fetch(
      `/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`,
      { method: "GET" },
    );
    const listJson = await listRes.json().catch(() => ({}));
    if (!listRes.ok || !listJson?.ok) {
      setInventoryLoading(false);
      setInventoryEntities([]);
      setInventoryErr(listJson?.message || "Failed to load workflows.");
      return;
    }

    const rows = ((listJson.entities as any[]) ?? []) as Array<{
      externalId: string;
      displayName: string;
      entityKind: string;
      enabledForAnalytics: boolean;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;

    setInventoryEntities(
      rows.map((r) => ({
        externalId: String(r.externalId),
        displayName: String(r.displayName ?? ""),
        entityKind: String(r.entityKind ?? "workflow"),
        createdAt: r.createdAt ?? null,
        updatedAt: r.updatedAt ?? null,
      })),
    );

    // Load indexed entities for this source to preselect them
    try {
      const indexedSet = await getIndexedExternalIdsForSource(sourceId);
      setSelectedExternalIds(indexedSet);
    } catch {
      // leave selection as-is; do not affect inventoryEntities
    }
    setInventoryLoading(false);
  }

  async function importInventory(platform: string, sourceId: string) {
    const res = await fetch(`/api/connections/inventory/${encodeURIComponent(platform)}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || "Failed to import inventory.");
    }
    return json;
  }

  async function listInventory(platform: string, sourceId: string) {
    const res = await fetch(
      `/api/connections/inventory/${encodeURIComponent(platform)}/list?sourceId=${encodeURIComponent(sourceId)}`,
      { method: "GET" },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || "Failed to load inventory.");
    }
    const rows = Array.isArray(json?.inventoryEntities) ? json.inventoryEntities : [];
    return rows.map((r: any) => ({
      externalId: String(r.externalId),
      displayName: String(r.displayName ?? ""),
      entityKind: String(r.entityKind ?? "resource"),
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  }

  async function openManageIndexed(platform: string, sourceId: string) {
    setErrMsg(null);
    setInventoryErr(null);
    setInventoryEntities([]);
    setSelectedExternalIds(new Set());
    setSelectedPlatform(platform as any);
    setSelectedMethod("api");
    setCreatedSourceId(sourceId);
    setIsPostConnectSelection(false);

    setInventoryLoading(true);

    try {
      await importInventory(platform, sourceId);
      const rows = await listInventory(platform, sourceId);
      setInventoryEntities(rows);

      const indexedSet = await getIndexedExternalIdsForSource(sourceId);
      setSelectedExternalIds(indexedSet);

      setConnectOpen(true);
      setStep("entities");
    } catch (e: any) {
      setInventoryEntities([]);
      setSelectedExternalIds(new Set());
      const errorMessage = String(e?.message ?? e);
      setInventoryErr(errorMessage);
      // Still open the modal so the user can SEE the error
      setConnectOpen(true);
      setStep("entities");
    } finally {
      setInventoryLoading(false);
    }
  }

  function beginEditCredential(credential: CredentialRow) {
  // Make is API-only now. Legacy Make webhook credentials should still open a usable edit screen.
  const platform = String(credential.platformType || "");
  const savedMethod = credential.method;

  const effectiveMethod =
    platform === "make" ? "api" : savedMethod;

  setSelectedPlatform(platform as any);
  setSelectedMethod(effectiveMethod as any);
  setConnectionName(credential.name || "");
  setEditingSourceId(credential.id);
  setEditingMeta({
    sourceId: credential.id,
    platformType: credential.platformType,
    method: effectiveMethod,
    name: credential.name || "",
  });
  setErrMsg(null);
  setSaving(false);

  // reset editor toggles
  setShowApiKeyEditor(false);

  // Indicators
  if (effectiveMethod === "api") {
    setApiKeySaved(true);
    setInstanceUrlSaved(platform === "n8n"); // only n8n uses instance URL meaningfully here
    setApiKey("");
    
    // Set instanceUrl from credential for n8n
    if (platform === "n8n" && credential.instanceUrl) {
      setInstanceUrl(String(credential.instanceUrl));
    } else {
      setInstanceUrl("");
    }
  }
  

  setConnectOpen(true);
  setStep("credentials");
}

  function openEditCredential(sourceId: string) {
    const cred = credentials.find((c) => c.id === sourceId);
    if (!cred) return;
    beginEditCredential(cred);
  }

  useEffect(() => {
    refreshIndexedEntities();
    refreshCredentials(); // ADD THIS LINE
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
      if (!target.closest('[data-entity-menu]') && !target.closest('[data-credential-menu]')) {
        setOpenEntityMenuId(null);
        setDeleteConfirmId(null);
        setOpenCredentialMenuId(null);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDetailsOpen(false);
        setSelectedEntity(null);
      }
    }
    if (detailsOpen) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [detailsOpen]);

  useEffect(() => {
    if (connectOpen && step === "entities" && selectedPlatform === "n8n" && createdSourceId) {
      loadN8nInventory(createdSourceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectOpen, step, selectedPlatform, createdSourceId]);

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

  const selectableFromThisSource = useMemo(() => {
    if (!createdSourceId) return [];
    return indexedEntities.filter((e) => String(e.sourceId) === String(createdSourceId));
  }, [indexedEntities, createdSourceId]);

  const displayedSelectable = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();

    const base = inventoryEntities.map((e) => ({
      id: `${createdSourceId ?? "source"}:${e.externalId}`,
      externalId: e.externalId,
      name: e.displayName,
    }));

    const filtered = q
      ? base.filter((x) => x.name.toLowerCase().includes(q) || x.externalId.toLowerCase().includes(q))
      : base;

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [inventoryEntities, inventorySearch, createdSourceId]);

  function resetModal() {
    setStep("platform");
    setSelectedPlatform(null);
    setSelectedMethod("api");
    setSelectedRegion('us2');
    setN8nAuthMode("bearer");
    setApiKey("");
    setInstanceUrl("");
    setAuthHeader("");
    setConnectionName("");

    setCreatedSourceId(null);
    setConnectEntities([]);
    setEntityExternalId("");
    setEntityDisplayName("");
    setIsPostConnectSelection(false);
    setSaving(false);
    setErrMsg(null);
    setConnectSummary(null);
    setLastConnectError(null);
    setConnectWarnings([]);
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

    // Safety guard: Make connections must use API method
    if (selectedPlatform === "make" && selectedMethod !== "api") {
      setSelectedMethod("api");
    }

    // Safety guard: Vapi connections must use API method
    if (selectedPlatform === "vapi" && selectedMethod !== "api") {
      setSelectedMethod("api");
    }

    // Safety guard: Retell connections must use API method
    if (selectedPlatform === "retell" && selectedMethod !== "api") {
      setSelectedMethod("api");
    }

    setSaving(true);
    setErrMsg(null);

    const payload: any = {
      platformType: selectedPlatform,
      method: selectedMethod,
      name: connectionName || PLATFORM_META[selectedPlatform].label,
    };

    if (selectedMethod === "api") {
      const isEdit = !!editingSourceId;
      const requireKeyForEdit = isEdit ? showApiKeyEditor : true;
      
      if (selectedPlatform === "vapi") {
        if (requireKeyForEdit && !apiKey.trim()) {
          setSaving(false);
          setErrMsg("Private API Key is required.");
          return;
        }
      }
      
      if (selectedPlatform === "retell" && selectedMethod === "api") {
        if (requireKeyForEdit && !apiKey.trim()) {
          setSaving(false);
          setErrMsg("API Key is required.");
          return;
        }
      }
      
      if (selectedPlatform === "n8n" && selectedMethod === "api") {
        if (requireKeyForEdit && !apiKey.trim()) {
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
      
      // Include key only if required (new) or changed (edit)
      if (requireKeyForEdit) {
        payload.apiKey = apiKey;
      }

      if (instanceUrl) payload.instanceUrl = instanceUrl.trim();

      // Add region for Make.com
      if (selectedPlatform === "make") {
        payload.region = selectedRegion;
      }

      // n8n requires X-N8N-API-KEY header for all key types (including JWTs)
      if (selectedPlatform === "n8n") {
        payload.n8nAuthMode = "header";
      }
      
      // For n8n API, normalize instanceUrl to base origin only
      if (selectedPlatform === "n8n" && instanceUrl.trim()) {
        try {
          const u = new URL(instanceUrl.trim());
          payload.instanceUrl = `${u.origin}/`;
        } catch {
          payload.instanceUrl = instanceUrl.trim();
        }
      }
    }

    if (selectedMethod === "webhook") {
      if (instanceUrl) payload.instanceUrl = instanceUrl.trim();
    }

    

    const url = editingSourceId ? "/api/credentials/update" : "/api/connections/connect";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingSourceId
          ? { ...payload, sourceId: editingSourceId }
          : payload
      ),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setSaving(false);

      const message =
        typeof json?.message === "string" && json.message.trim()
          ? json.message
          : "Connection failed. Please check your credentials and try again.";
      const code = typeof json?.code === "string" && json.code.trim() ? ` (${json.code})` : "";

      setErrMsg(`${message}${code}`);

      setLastConnectError({
        ts: new Date().toISOString(),
        platformType: selectedPlatform,
        method: selectedMethod,
        status: res.status,
        code: json?.code,
        message: json?.message,
        details: json?.details,
        userAction: json?.userAction,
      });
      return;
    }

    // Store any warnings from successful backend response
    const warnings = Array.isArray(json?.warnings) ? json.warnings : [];
    setConnectWarnings(
      warnings
        .filter((w: any) => w && typeof w.message === "string")
        .map((w: any) => ({ code: String(w.code || "WARNING"), message: String(w.message) })),
    );

    if (selectedPlatform === "vapi") {
      setConnectSummary({ callsLoaded: typeof json?.callsLoaded === "number" ? json.callsLoaded : undefined });
    }

    if (editingSourceId) {
      setEditingSourceId(null);
      await refreshCredentials();
      
      // If the user did change secret fields, reset the saved indicators for safety
      if (showApiKeyEditor) {
        setApiKeySaved(false);
        setInstanceUrlSaved(false);
        setShowApiKeyEditor(false);
      }
      
      
      // NEW: For n8n, offer to manage indexed workflows
      if (selectedPlatform === "n8n" && selectedMethod === "api") {
        // Set sourceId to the one we just edited
        setCreatedSourceId(editingSourceId);
        
        // Load inventory
        await loadN8nInventory(editingSourceId);
        
        // Load already-indexed entities for this source
        const indexedRes = await fetch("/api/indexed-entities/list");
        const indexedJson = await indexedRes.json().catch(() => ({}));
        if (indexedRes.ok && indexedJson?.ok) {
          const alreadyIndexed = (indexedJson.entities || [])
            .filter((e: any) => String(e.sourceId) === editingSourceId)
            .map((e: any) => String(e.externalId));
          
          // Pre-select already indexed workflows
          setSelectedExternalIds(new Set(alreadyIndexed));
        }
        
        // Transition to entities step
        setConnectOpen(true);
        setStep("entities");
        setSaving(false);
        return;
      }
      
      closeConnect();
      return;
    }

    const sid = String(json?.sourceId || "");
    if (!sid) {
      setSaving(false);
      setErrMsg("Connection succeeded but no sourceId was returned by Getflowetic backend.");
      return;
    }
    setCreatedSourceId(sid);

    await refreshCredentials();

    // Handle Vapi inventory response
    if (selectedPlatform === "vapi" && Array.isArray(json.inventoryEntities)) {
      setIsPostConnectSelection(true);
      setInventoryEntities(json.inventoryEntities);
      setConnectOpen(true);
      setStep("entities");
      setSaving(false);
      return;
    }

    // Handle Retell inventory response
    if (selectedPlatform === "retell" && Array.isArray(json.inventoryEntities)) {
      const inventoryEntities = json.inventoryEntities.map((entity: any) => ({
        externalId: String(entity.externalId),
        displayName: String(entity.displayName || ""),
        entityKind: String(entity.entityKind || "agent"),
      }));
      setIsPostConnectSelection(true);
      setInventoryEntities(inventoryEntities);
      setConnectOpen(true);
      setStep("entities");
      setSaving(false);
      return;
    }

    if (selectedPlatform === "n8n" && selectedMethod === "api") {
      setIsPostConnectSelection(true);
      setSaving(false); // Stop loading first
      await loadN8nInventory(sid);
      // Ensure modal stays open and step transitions
      setConnectOpen(true);
      setStep("entities");
      return;
    }

    if (selectedPlatform === "make") {
      const invFromConnect = Array.isArray(json?.inventoryEntities) ? json.inventoryEntities : null;

      const mappedFromConnect =
        invFromConnect?.map((entity: any) => ({
          externalId: String(entity.externalId),
          displayName: String(entity.displayName || ""),
          entityKind: String(entity.entityKind || "scenario"),
        })) ?? [];

      setIsPostConnectSelection(true);

      if (mappedFromConnect.length > 0) {
        setInventoryEntities(mappedFromConnect);
        setConnectOpen(true);
        setStep("entities");
        setSaving(false);
        return;
      }

      try {
        await importInventory("make", sid);
        const rows = await listInventory("make", sid);
        setInventoryEntities(rows);
        setConnectOpen(true);
        setStep("entities");
        setSaving(false);
        return;
      } catch (e: any) {
        setSaving(false);
        setErrMsg(e?.message || "Failed to load Make scenarios.");
        return;
      }
    }

    setStep("success");
    setSaving(false);
    return;
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
        enabledForActions: false,
      },
    ]);

    setEntityExternalId("");
    setEntityDisplayName("");
  }

  function removeEntityDraft(idx: number) {
    setConnectEntities((prev) => prev.filter((_, i) => i !== idx));
  }

  function openDeleteCredential(sourceId: string, platformType: string) {
    setErrMsg(null);
    setCredentialDeletePlatformType(String(platformType || ""));
    setCredentialDeleteId(sourceId);
    setCredentialDeleteConfirm(false);
  }

  async function saveEntitiesSelection() {
    if (!createdSourceId) return;
    if (selectedExternalIds.size === 0) {

      setErrMsg(
        selectedPlatform === "vapi"
          ? "Select at least one assistant to index."
          : selectedPlatform === "retell"
          ? "Select at least one agent to index."
          : "Select at least one workflow to index."
      );

      return;
    }
    const selected = new Set(selectedExternalIds);
    const selectedRows = inventoryEntities.filter((e) => selected.has(String(e.externalId)));
    
    if (selectedRows.length === 0) {
      setErrMsg("Your selection could not be saved because no matching entities were loaded. Please refresh inventory and try again.");
      return;
    }
    
    const entitiesPayload = selectedRows.map((e) => ({
      externalId: String(e.externalId),
      displayName: String(e.displayName ?? ""),
      entityKind: String(
        e.entityKind ??
          (selectedPlatform === "vapi"
            ? "assistant"
            : selectedPlatform === "make"
            ? "scenario"
            : selectedPlatform === "retell"
            ? "agent"
            : "workflow"),
      ),
      enabledForAnalytics: true,
      enabledForActions: false,
    }));
    setSaving(true);
    setErrMsg(null);
    // IMPORTANT: When editing, we need to REPLACE (not append) the indexed entities
    // Backend should handle this by first unindexing all, then indexing selected ones
    const res = await fetch("/api/connections/entities/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: createdSourceId,
        entities: entitiesPayload,
        replaceExisting: true, // NEW: Tell backend to replace, not append
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      console.error("[connections] saveEntitiesSelection failed", { status: res.status, json });
      setSaving(false);
      
      const msg =
        typeof json?.message === "string" && json.message.trim()
          ? json.message
          : "Failed to save selection.";

      const code =
        typeof json?.code === "string" && json.code.trim()
          ? ` (${json.code})`
          : "";

      setErrMsg(`${msg}${code}`);
      return;
    }
    
    // SUCCESS: Refresh data in correct order
    setSaving(false);
    
    // Refresh indexed entities first (backend just wrote them)
    await refreshIndexedEntities();
    
    // Refresh credentials to ensure credential row appears
    await refreshCredentials();
    
    // Switch to All tab to show newly indexed items
    setFilter("all");
    setAllSearch("");
    setAllSort("created_at");
    
    // NOW close modal after everything is ready
    closeConnect();
  }

  

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
  return indexedEntities;
}, [indexedEntities]);

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
                placeholder="Search by name..."
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
            <div className="mt-6 max-h-[calc(100vh-320px)] overflow-auto space-y-3 pb-6">
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

                        <div data-entity-menu className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setMenuPos({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.right + window.scrollX - 160, // anchor to right edge
                              });
                              setDeleteConfirmId(null);
                              setOpenEntityMenuId(openEntityMenuId === entity.id ? null : entity.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                            aria-label="Entity actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {indexedEntities.length === 0 ? (
                <div className="rounded-lg border bg-white p-8 text-sm text-gray-600">No results.</div>
              ) : null}
            </div>
          ) : null}
        </div>
        </>
      ) : null}

      {/* Entity dropdown menus rendered at higher level */}
      {filter === "all" && openEntityMenuId ? (() => {
        const openEntity = displayedIndexedEntities.find((entity) => entity.id === openEntityMenuId);
        if (!openEntity) return null;
        return (
          <div className="fixed inset-0 z-50" data-entity-menu onClick={() => { setOpenEntityMenuId(null); setMenuPos(null); }}>
            <div
              className="fixed z-50 w-40 rounded-lg border bg-white shadow-lg"
              style={{
                top: `${menuPos!.top}px`,
                left: `${menuPos!.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedEntity(openEntity);
                  setDetailsOpen(true);
                  setOpenEntityMenuId(null);
                  setDeleteConfirmId(null);
                  setMenuPos(null);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                View details
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirmId !== openEntity.id) {
                    setDeleteConfirmId(openEntity.id);
                    return;
                  }

                  setOpenEntityMenuId(null);
                  setMenuPos(null);

                  const res = await fetch("/api/indexed-entities/unindex", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sourceId: openEntity.sourceId, externalId: openEntity.externalId }),
                  });
                  const json = await res.json().catch(() => ({}));

                  setDeleteConfirmId(null);
                  setMenuPos(null);

                  if (!res.ok || !json?.ok) {
                    setIndexedErr(json?.message || "Failed to remove from index.");
                    return;
                  }

                  refreshIndexedEntities();
                }}
                className={
                  "flex w-full items-start gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 " +
                  (deleteConfirmId === openEntity.id ? "bg-red-100" : "")
                }
              >
                <Trash2 className="mt-0.5 h-4 w-4" />
                <span className="leading-tight">
                  {deleteConfirmId === openEntity.id ? (
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
          </div>
        );
      })() : null}

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

          {errMsg ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errMsg}
            </div>
          ) : null}

          {credentialsLoading ? (
            <div className="mt-8 text-sm text-gray-600">Loading credentials…</div>
          ) : null}

          {!credentialsLoading ? (
            <div className="mt-6 max-h-[calc(100vh-320px)] overflow-auto space-y-3 pb-6">
              {displayedCredentials.map((cred) => {
                const meta = getPlatformMeta(String(cred.platformType));
                const Icon = meta?.Icon;

                const methodLabel = cred.method === "api" ? "API" : "Webhook";
                const methodIcon =
                  cred.method === "api" ? (
                    <KeyRound className="h-3.5 w-3.5" />
                  ) : cred.method === "webhook" ? (
                    <WebhookIcon className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  );

                return (
                  <div key={cred.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                          {Icon ? <Icon className="h-5 w-5" /> : null}
                        </div>

                        <div>
                          <div className="font-semibold text-gray-900">{meta?.label ?? cred.name}</div>
                          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              {methodIcon}
                              <span>{methodLabel}</span>
                            </span>

                            <span className="text-gray-300">|</span>
                            <span>Last updated {formatRelativeFromIso(cred.updated_at)}</span>

                            <span className="text-gray-300">|</span>
                            <span>Created {formatDateFromIso(cred.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusPill status={cred.status} />
                        <div data-credential-menu className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setMenuPos({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.right + window.scrollX - 160,
                              });
                              setOpenCredentialMenuId(openCredentialMenuId === cred.id ? null : cred.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                            aria-label="Credential actions"
                          >
                            <MoreVertical className="h-5 w-5 text-gray-600" />
                          </button>
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

      {/* Credential dropdown menus rendered at higher level */}
      {filter === "credentials" && openCredentialMenuId ? (() => {
        const openCred = displayedCredentials.find((c) => c.id === openCredentialMenuId);
        if (!openCred) return null;

        return (
          <div
            className="fixed inset-0 z-50"
            data-entity-menu
            onClick={() => { setOpenCredentialMenuId(null); setMenuPos(null); }}
          >
            <div
              className="fixed z-50 w-40 rounded-lg border bg-white shadow-lg"
              style={{
                top: `${menuPos!.top}px`,
                left: `${menuPos!.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenCredentialMenuId(null);
                  setMenuPos(null);
                  beginEditCredential(openCred);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>

              {/* Show for all platforms that support inventory management */}
              {(openCred.platformType === "n8n" && openCred.method === "api") ||
               (openCred.platformType === "make") ||
               (openCred.platformType === "vapi") ||
               (openCred.platformType === "retell") ? (
                <button
                  type="button"
                  onClick={async () => {
                    setOpenCredentialMenuId(null);
                    setMenuPos(null);
                    
                    // Use the generalized inventory management function
                    openManageIndexed(String(openCred.platformType), String(openCred.id));
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="h-4 w-4" />
                  Manage Indexed
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setOpenCredentialMenuId(null);
                  setMenuPos(null);
                  openDeleteCredential(openCred.id, openCred.platformType);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        );
      })() : null}

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
                        ? editingSourceId ? "Edit Platform" : "Connect Platform"
                        : step === "method"
                        ? `${editingSourceId ? "Edit" : "Connect"} ${selectedPlatform ? (getPlatformMeta(String(selectedPlatform))?.label ?? String(selectedPlatform)) : ""}`
                        : step === "credentials"
                        ? `${editingSourceId ? "Edit " : "Connect "}${selectedPlatform ? (getPlatformMeta(String(selectedPlatform))?.label ?? String(selectedPlatform)) : ""} Credentials`
                        : step === "entities"
                        ? editingSourceId 
                          ? `Manage indexed ${entityNoun(String(selectedPlatform))}`
                          : `Select ${entityNoun(String(selectedPlatform))} to index`
                        : "Connected"}
                    </div>
                    
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {step === "platform"
                      ? "Choose which platform you want to connect."
                      : step === "method"
                      ? "Choose a connection method."
                      : step === "credentials"
                      ? selectedPlatform === "make"
                        ? "Enter your API token to import your Make scenarios."
                        : editingSourceId
                          ? null
                          : selectedPlatform === "n8n"
                            ? "Settings → n8n API → Create an API key"
                            : "Enter credentials to validate and connect."
                      : step === "entities"
                      ? editingSourceId
                        ? `Update which ${entityNoun(String(selectedPlatform))} GetFlowetic should index. Unselected ${entityNoun(String(selectedPlatform))} will be removed from your All tab.`
                        : `Add ${entityNoun(String(selectedPlatform))} you want GetFlowetic to index.`
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
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">{errMsg}</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!lastConnectError) return;
                          navigator.clipboard.writeText(JSON.stringify(lastConnectError, null, 2));
                        }}
                        className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                        disabled={!lastConnectError}
                      >
                        Copy error details
                      </button>
                    </div>
                    {lastConnectError?.userAction === "contact_support" ? (
                      <div className="mt-2 text-xs text-red-700/80">
                        This looks like a Getflowetic issue (not something you can fix). Please contact support and click "Copy error details".
                      </div>
                    ) : null}
                  </div>
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
                            setSelectedRegion('us2'); // Reset to default region when platform changes
                            setErrMsg(null);

                            // Make.com: token-only flow (skip method selection entirely)
                            if (String(k) === "make") {
                              setSelectedMethod("api");
                              setStep("credentials");
                              return;
                            }

                            // Vapi: API-only flow (skip method selection entirely)
                            if (String(k) === "vapi") {
                              setSelectedMethod("api");
                              setStep("credentials");
                              return;
                            }

                            // Retell: API-only flow (skip method selection entirely)
                            if (String(k) === "retell") {
                              setSelectedMethod("api");
                              setStep("credentials");
                              return;
                            }

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
      className="w-full rounded-xl border border-gray-300 bg-white p-4 text-left shadow-sm transition hover:border-gray-400 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-gray-900">API Key</div>
          <div className="mt-1 text-sm text-gray-600">
            Connect using an API key to import and index workflows.
          </div>
        </div>
      </div>
    </button>

    {selectedPlatform === "n8n" && (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left opacity-60 cursor-not-allowed">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">MCP Instances</div>
            <div className="mt-1 text-sm text-gray-600">
              Securely search, audit, and trigger specific workflows via a centralized connection.
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
            Coming Soon
          </span>
        </div>
      </div>
    )}

    {selectedPlatform !== "n8n" && selectedPlatform !== "make" && selectedPlatform !== "vapi" && selectedPlatform !== "retell" ? (
      <button
        type="button"
        onClick={() => {
          setSelectedMethod("webhook");
          setErrMsg(null);
          setStep("credentials");
        }}
        className="w-full rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-slate-50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <WebhookIcon className="h-5 w-5 text-slate-700" />
            Webhook Only
          </div>
          <span className="rounded bg-slate-700 px-2 py-1 text-xs font-bold text-white">
            NO API
          </span>
        </div>
        <div className="mt-1 text-sm text-gray-700">
          Manual event streaming to GetFlowetic. No catalog import.
        </div>
      </button>
    ) : null}



    
    <div className="flex justify-end gap-2 pt-4">
      <button
        type="button"
        onClick={() => setStep("platform")}
        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        Back
      </button>
    </div>
  </div>
) : null}
{step === "credentials" ? (
  <div className="space-y-4">
    {selectedMethod === "api" ? (
      <div className="space-y-4">
        {selectedPlatform === "make" && !editingSourceId ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="font-semibold">💡 How to get your API token:</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-900">
              <li>Go to make.com → Your profile → API access</li>
              <li>Click &quot;+ Add token&quot;</li>
              <li>
                Select these scopes:
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>scenarios:read</li>
                  <li>scenarios:run</li>
                  <li>organizations:read</li>
                  <li>teams:read</li>
                </ul>
              </li>
              <li>Click &quot;Add&quot; and copy your token</li>
            </ul>
            <div className="mt-3 text-xs text-blue-900/80">⚠️ Requires Make paid plan</div>
          </div>
        ) : null}
        {selectedPlatform !== "vapi" && selectedPlatform !== "retell" ? (
          <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">
              {selectedPlatform === "make" ? "API Token *" : "API Key *"}
            </label>
            {editingSourceId && apiKeySaved ? (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                Saved
              </span>
            ) : null}
          </div>

          {editingSourceId && !showApiKeyEditor ? (
            <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
              <div className="text-sm text-gray-600">••••••••••••••</div>
              <button
                type="button"
                onClick={() => setShowApiKeyEditor(true)}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Change key
              </button>
            </div>
          ) : (
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder={selectedPlatform === "make" ? "Paste your Make API token here" : (editingSourceId ? "Enter a new API key to replace" : "••••••••••••••")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {editingSourceId ? (
            <div className="text-xs text-gray-500">
              You can't view existing keys. Enter a new key only if you want to replace it.
            </div>
          ) : null}
          </div>
        ) : null}

        {/* Vapi-specific credentials UI */}
        {selectedPlatform === "vapi" ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Private API Key <span className="text-red-600">*</span>
                </label>
                {editingSourceId && apiKeySaved ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    Saved
                  </span>
                ) : null}
              </div>

              {editingSourceId && !showApiKeyEditor ? (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-sm text-gray-600">•••••••••••••••••••</div>
                  <button
                    type="button"
                    onClick={() => setShowApiKeyEditor(true)}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    Change key
                  </button>
                </div>
              ) : (
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={editingSourceId ? "Enter a new private API key to replace" : "ca-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
                  autoComplete="off"
                />
              )}

              {editingSourceId && !showApiKeyEditor ? (
                <div className="text-xs text-gray-500">
                  A key is already saved. For security, it can't be viewed. Click "Change key" to replace it.
                </div>
              ) : null}
            </div>

            {editingSourceId ? null : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="font-semibold">💡 Where to find this:</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Go to dashboard.vapi.ai</li>
                  <li>Click &quot;API Keys&quot; in the sidebar</li>
                  <li>
                    Copy your &quot;Private API Key&quot; (under &quot;Server-side API access&quot;)
                  </li>
                </ol>
              </div>
            )}
          </div>
        ) : null}

        {/* Retell-specific credentials UI */}
        {selectedPlatform === "retell" ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  API Key <span className="text-red-600">*</span>
                </label>
                {editingSourceId && apiKeySaved ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    Saved
                  </span>
                ) : null}
              </div>

              {editingSourceId && !showApiKeyEditor ? (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-sm text-gray-600">•••••••••••••••••••</div>
                  <button
                    type="button"
                    onClick={() => setShowApiKeyEditor(true)}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    Change key
                  </button>
                </div>
              ) : (
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={editingSourceId ? "Enter a new API key to replace" : "Paste your Retell API Key here"}
                  autoComplete="off"
                />
              )}

              {editingSourceId && !showApiKeyEditor ? (
                <div className="text-xs text-gray-500">
                  A key is already saved. For security, it can't be viewed. Click "Change key" to replace it.
                </div>
              ) : null}
            </div>

            {editingSourceId ? null : (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="font-semibold">💡 Where to find this:</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Go to dashboard.retellai.com</li>
                  <li>Click &quot;API Keys&quot; in the sidebar</li>
                  <li>
                    Copy your API Key (NOT the webhook secret key)
                  </li>
                </ol>
              </div>
            )}
          </div>
        ) : null}

        {/* NEW: Region Selector - Only show for Make.com */}
        {selectedPlatform === "make" && !editingSourceId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Your Region
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['us1', 'us2', 'eu1', 'eu2'] as const).map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm transition-all
                    ${selectedRegion === region
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {region.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Find your region in your Make.com URL (e.g., us2.make.com means US2)
            </p>
          </div>
        )}
      </div>
    ) : null}

    {(selectedPlatform === "n8n" || selectedPlatform === "activepieces") ? (
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-900">
            {selectedPlatform === "n8n" && selectedMethod === "api" ? "Instance URL *" : "Instance URL (optional)"}
          </label>
          {editingSourceId && instanceUrlSaved ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
              Saved
            </span>
          ) : null}
        </div>
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

    {selectedMethod === "webhook" && selectedPlatform !== "vapi" ? (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Webhook-only mode will create a connection, but you'll need to send events manually.
      </div>
    ) : null}

    

    {selectedPlatform !== "n8n" && selectedPlatform !== "make" && selectedPlatform !== "vapi" && selectedPlatform !== "retell" ? (
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
      {!editingSourceId ? (
        <button
          type="button"
          onClick={() => {
            setErrMsg(null);
            // Make, Vapi, and Retell go back to platform selection since they skip method step
            if (selectedPlatform === "make" || selectedPlatform === "vapi" || selectedPlatform === "retell") {
              setStep("platform");
              return;
            }
            setStep("method");
            return;
          }}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          disabled={saving}
        >
          Back
        </button>
      ) : null}
      <button
        type="button"
        onClick={createConnection}
        disabled={saving}
        className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? (editingSourceId ? "Saving..." : "Connecting...") : (editingSourceId ? "Save Changes" : "Connect")}
      </button>
    </div>
  </div>
) : null}
{step === "entities" ? (
  <div className="space-y-4">

    {inventoryErr ? (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inventoryErr}</div>
    ) : null}

    {inventoryLoading ? (
      <div className="text-sm text-gray-600">
        {selectedPlatform === "vapi" ? "Loading assistants…" : selectedPlatform === "retell" ? "Loading agents…" : "Loading workflows…"}
      </div>
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
            placeholder={
              selectedPlatform === "vapi"
                ? "Search assistants..."
                : selectedPlatform === "retell"
                ? "Search agents..."
                : "Search workflows..."
            }
          />
        </div>
      </div>

      <div className="max-h-[320px] overflow-auto rounded-lg border border-gray-200 bg-white">
        {!inventoryErr && displayedSelectable.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            {selectedPlatform === "make"
              ? "No scenarios found in this Make account."
              : selectedPlatform === "vapi"
              ? "No assistants found in this Vapi account."
              : selectedPlatform === "retell"
              ? "No agents found in this Retell account."
              : "No workflows found in this n8n instance."}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {displayedSelectable.map((e) => {
              const checked = selectedExternalIds.has(e.externalId);
              return (
                <label key={e.id} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{e.name}</div>
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
        onClick={async () => {
          await saveEntitiesSelection();
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
    {connectWarnings.length ? (
      <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
        <div className="font-semibold">⚠️ Warnings</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {connectWarnings.map((w, idx) => (
            <li key={`${w.code}-${idx}`}>{w.message}</li>
          ))}
        </ul>
      </div>
    ) : null}
    {selectedPlatform === "vapi" && connectSummary?.callsLoaded !== undefined ? (
      <div className="mt-2 text-sm text-gray-700">
        ✅ Loaded {connectSummary.callsLoaded} recent calls
      </div>
    ) : null}

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setDetailsOpen(false);
            setSelectedEntity(null);
          }}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Details</div>
              <button
                type="button"
                onClick={() => {
                  setDetailsOpen(false);
                  setSelectedEntity(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* KEEP your existing details modal body content below */}
            <div className="px-6 py-5 space-y-6">
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

      

      {credentialDeleteId ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{getCredentialDeleteCopy(credentialDeletePlatformType || "n8n").title}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {getCredentialDeleteCopy(credentialDeletePlatformType || "n8n").description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCredentialDeleteId(null);
                    setCredentialDeletePlatformType(null);
                    setCredentialDeleteConfirm(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {getCredentialDeleteCopy(credentialDeletePlatformType || "n8n").warning}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="confirmCredDelete"
                  type="checkbox"
                  checked={credentialDeleteConfirm}
                  onChange={(e) => setCredentialDeleteConfirm(e.target.checked)}
                />
                <label htmlFor="confirmCredDelete" className="text-sm text-gray-700">
                  {getCredentialDeleteCopy(credentialDeletePlatformType || "n8n").confirmLabel}
                </label>
              </div>

              {errMsg ? (
                <div className="whitespace-pre-wrap select-text rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errMsg}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCredentialDeleteId(null);
                    setCredentialDeletePlatformType(null);
                    setCredentialDeleteConfirm(false);
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!credentialDeleteConfirm || saving}
                  onClick={async () => {
                    const id = credentialDeleteId;
                    if (!id) return;
                    await deleteCredentialById(id);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
