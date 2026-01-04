
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Edit,
  MoreVertical,
  Trash2,
  Filter as FilterIcon,
  Search as SearchIcon,
} from "lucide-react";

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

const entityTypeLabel: Record<EntityType, string> = {
  workflow: "Workflow",
  agent: "Agent",
  voice_agent: "Voice Agent",
  automation: "Automation",
};

function PlatformIcon({ platform }: { platform: string }) {
  // Keep this simple and resilient: if you have real icons, swap this mapping later.
  const icons: Record<string, string> = {
    n8n: "https://placehold.co/24x24/ff5a5f/white?text=n8n",
    Make: "https://placehold.co/24x24/3b82f6/white?text=M",
    Activepieces: "https://placehold.co/24x24/10b981/white?text=AP",
    Vapi: "https://placehold.co/24x24/8b5cf6/white?text=V",
    Retell: "https://placehold.co/24x24/f59e0b/white?text=R",
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icons[platform] || "https://placehold.co/24x24/6b7280/white?text=%F0%9F%93%8B"}
      alt={`${platform} logo`}
      className="h-6 w-6 rounded"
    />
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

function EntityRow({
  entity,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  entity: IndexedEntity;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
      <div className="flex items-center space-x-3">
        <PlatformIcon platform={entity.platform} />
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

          <KebabMenu
            isOpen={menuOpen}
            onToggle={onToggleMenu}
            onClose={onCloseMenu}
            onViewDetails={() => {
              // Replace with real details route when ready.
              window.alert(`View Details: ${entity.name}`);
            }}
            onEdit={() => {
              window.alert(`Edit: ${entity.name}`);
            }}
            onDelete={() => {
              // Replace with real delete API call when ready.
              window.alert(`Delete: ${entity.name}`);
            }}
          />
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

  const [showFilters, setShowFilters] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("indexed");

  const [pendingPlatformFilter, setPendingPlatformFilter] = useState<string>("all");
  const [pendingTypeFilter, setPendingTypeFilter] = useState<string>("all");
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>("indexed");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  useEffect(() => {
    loadEntities();
  }, []);

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

    // Filters
    if (statusFilter !== "all") {
      // this UI currently only shows Indexed rows; keep for forward compatibility
      if (statusFilter === "indexed") list = list.filter((e) => e.indexed !== false);
      if (statusFilter === "not_indexed") list = list.filter((e) => e.indexed === false);
    }
    if (platformFilter !== "all") list = list.filter((e) => e.platform === platformFilter);
    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);

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

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">All</h1>
        <p className="text-gray-600">Workflows, agents, and automations you have indexed</p>
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

          <button
            type="button"
            onClick={() => {
              setShowFilters((v) => !v);
              // initialize pending values from applied values when opening
              if (!showFilters) {
                setPendingPlatformFilter(platformFilter);
                setPendingTypeFilter(typeFilter);
                setPendingStatusFilter(statusFilter);
              }
            }}
            className="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
          >
            <FilterIcon className="h-4 w-4" />
            <span>Filters</span>
          </button>
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

      {showFilters ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Platform</label>
              <select
                value={pendingPlatformFilter}
                onChange={(e) => setPendingPlatformFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="all">All platforms</option>
                {platformOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Type</label>
              <select
                value={pendingTypeFilter}
                onChange={(e) => setPendingTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="all">All types</option>
                <option value="workflow">Workflow</option>
                <option value="agent">Agent</option>
                <option value="voice_agent">Voice Agent</option>
                <option value="automation">Automation</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={pendingStatusFilter}
                onChange={(e) => setPendingStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="indexed">Indexed</option>
                <option value="not_indexed">Not indexed</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setPlatformFilter(pendingPlatformFilter);
                  setTypeFilter(pendingTypeFilter);
                  setStatusFilter(pendingStatusFilter);
                }}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              menuOpen={openMenuId === entity.id}
              onToggleMenu={() => setOpenMenuId((cur) => (cur === entity.id ? null : entity.id))}
              onCloseMenu={() => setOpenMenuId(null)}
            />
          ))}
          {filteredEntities.length === 0 ? (
            <div className="rounded-lg border bg-white p-8 text-sm text-gray-600">
              No results. Try a different search or filter.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
