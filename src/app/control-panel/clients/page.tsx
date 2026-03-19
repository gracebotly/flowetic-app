"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  ArchiveRestore,
  AlertTriangle,
} from "lucide-react";
import { HealthBar } from "@/components/clients/HealthBar";
import { TagBadge } from "@/components/clients/TagBadge";
import { CreateClientModal } from "@/components/clients/CreateClientModal";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  name: string;
  company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tags: string[];
  status: "active" | "paused";
  health_score: number | null;
  last_seen_at: string | null;
  offering_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [totalOfferings, setTotalOfferings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "paused" | "archived"
  >("all");
  const [sortBy, setSortBy] = useState("updated_at");
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline archive confirmation
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);

  const isArchivedView = statusFilter === "archived";

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter === "archived") {
      params.set("archived", "true");
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (search) params.set("q", search);
    params.set("sort", sortBy);

    const res = await fetch(`/api/clients?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      let fetchedClients = data.clients ?? [];
      // When viewing archived, only show clients that have archived_at set
      if (statusFilter === "archived") {
        fetchedClients = fetchedClients.filter(
          (client: Client) => client.archived_at !== null
        );
      }
      setClients(fetchedClients);
      setTotalOfferings(data.total_offerings ?? 0);
    }
    setLoading(false);
  }, [search, sortBy, statusFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedIds(new Set());
      setArchiveConfirmId(null);
      setBulkArchiveConfirm(false);
      void fetchClients();
    });
  }, [fetchClients]);

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === "active" ? "paused" : "active";
    await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setMenuOpenId(null);
    await fetchClients();
  };

  const handleArchive = async (clientId: string) => {
    setArchiving(true);
    await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setArchiving(false);
    setArchiveConfirmId(null);
    setMenuOpenId(null);
    await fetchClients();
  };

  const handleRestore = async (clientId: string) => {
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived_at: null, status: "active" }),
    });
    setMenuOpenId(null);
    await fetchClients();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((client) => client.id)));
    }
  };

  const handleBulkAction = async (
    action: "activate" | "pause" | "archive" | "restore"
  ) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (action === "archive") {
      setBulkArchiveConfirm(true);
      return;
    }

    for (const clientId of ids) {
      if (action === "restore") {
        await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived_at: null, status: "active" }),
        });
      } else {
        await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action === "activate" ? "active" : "paused" }),
        });
      }
    }

    setSelectedIds(new Set());
    await fetchClients();
  };

  const confirmBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    setArchiving(true);
    for (const clientId of ids) {
      await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    }
    setArchiving(false);
    setBulkArchiveConfirm(false);
    setSelectedIds(new Set());
    await fetchClients();
  };

  const activeCount = clients.filter((client) => client.status === "active").length;
  const pausedCount = clients.filter((client) => client.status === "paused").length;
  const archivedCount = clients.filter((client) => client.archived_at !== null).length;
  const avgHealth =
    clients.length > 0
      ? Math.round(
          clients.reduce((sum, client) => sum + (client.health_score ?? 0), 0) /
            clients.length
        )
      : 0;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Clients"
        subtitle="Manage your client accounts and engagement health."
        rightSlot={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Client
          </button>
        }
      />

      <div className="px-6 pb-6 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          {clients.length > 0 && (
            <input
              type="checkbox"
              checked={clients.length > 0 && selectedIds.size === clients.length}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              title="Select all"
            />
          )}
          <div className="relative max-w-xs min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "active" | "paused" | "archived"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
          >
            <option value="updated_at">Last updated</option>
            <option value="name">Name</option>
            <option value="health_score">Health score</option>
            <option value="last_seen_at">Last seen</option>
          </select>
        </div>

        {/* Archived view banner */}
        {isArchivedView && !loading && clients.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
            <ArchiveRestore className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              Viewing archived clients. Restore a client to make them active again.
            </span>
          </div>
        )}

        {/* Bulk archive confirmation banner */}
        {bulkArchiveConfirm && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-800">
                Archive {selectedIds.size} client{selectedIds.size !== 1 ? "s" : ""}? Their
                portals will be unassigned.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={confirmBulkArchive}
                disabled={archiving}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Yes, archive"}
              </button>
              <button
                onClick={() => setBulkArchiveConfirm(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <div className="text-sm text-gray-500">Loading clients...</div>
            </div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<Users size={64} />}
              title={isArchivedView ? "No archived clients" : "No clients yet"}
              subtitle={
                isArchivedView
                  ? "Archived clients will appear here. You can restore them at any time."
                  : "Add your first client to start tracking engagement health."
              }
            />
          ) : (
            clients.map((client) => {
              const isArchived = client.archived_at !== null;
              const showArchiveConfirm = archiveConfirmId === client.id;

              return (
                <div
                  key={client.id}
                  className={`group relative rounded-xl border bg-white px-5 py-4 shadow-sm transition ${
                    isArchived
                      ? "border-gray-100 opacity-75 hover:border-amber-200 hover:opacity-100"
                      : "cursor-pointer border-gray-200 hover:border-blue-200 hover:shadow-md"
                  }`}
                  onClick={() => {
                    if (!isArchived) router.push(`/control-panel/clients/${client.id}`);
                  }}
                >
                  {/* Inline archive confirmation overlay */}
                  {showArchiveConfirm && (
                    <div className="absolute inset-0 z-10 flex items-center justify-between rounded-xl border-2 border-red-200 bg-red-50/95 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        <span className="text-sm text-red-800">
                          Archive <strong>{client.name}</strong>?
                          {client.offering_count > 0
                            ? ` ${client.offering_count} portal${client.offering_count !== 1 ? "s" : ""} will be unassigned.`
                            : " No portals are assigned."}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleArchive(client.id);
                          }}
                          disabled={archiving}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {archiving ? "Archiving..." : "Yes, archive"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveConfirmId(null);
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(client.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          isArchived
                            ? "bg-gray-300"
                            : client.status === "active"
                              ? "bg-emerald-500"
                              : "bg-gray-300"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900">
                            {client.name}
                          </span>
                          {isArchived && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                              Archived
                            </span>
                          )}
                          {client.company && (
                            <span className="truncate text-xs text-gray-500">
                              {client.company}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {client.tags.map((tag) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-6">
                      {!isArchived && (
                        <div className="w-32">
                          <HealthBar score={client.health_score ?? 0} />
                        </div>
                      )}
                      {isArchived && (
                        <div className="w-32 text-right">
                          <div className="text-xs text-gray-500">Archived</div>
                          <div className="text-sm font-medium text-gray-500">
                            {formatRelative(client.archived_at)}
                          </div>
                        </div>
                      )}
                      <div className="w-24 text-right">
                        <div className="text-xs text-gray-500">Portals</div>
                        <div className="text-sm font-medium text-gray-900">
                          {client.offering_count}
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <div className="text-xs text-gray-500">Last seen</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatRelative(client.last_seen_at)}
                        </div>
                      </div>
                      <div className="relative">
                        {isArchived ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRestore(client.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === client.id ? null : client.id);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuOpenId === client.id && (
                              <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/control-panel/clients/${client.id}`);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  View details
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleToggleStatus(client);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  {client.status === "active" ? "Pause" : "Activate"}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    setArchiveConfirmId(client.id);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                  Archive
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {clients.length > 0 && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
            <span>
              {clients.length} client{clients.length !== 1 ? "s" : ""}
            </span>
            {!isArchivedView && (
              <>
                <span>·</span>
                <span>{activeCount} active</span>
                <span>·</span>
                <span>{pausedCount} paused</span>
                <span>·</span>
                <span>{totalOfferings} active portals</span>
                <span>·</span>
                <span>Avg health: {avgHealth}</span>
              </>
            )}
            {isArchivedView && (
              <>
                <span>·</span>
                <span>{archivedCount} archived</span>
              </>
            )}
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-xl">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size} selected
              </span>
              {isArchivedView ? (
                <button
                  onClick={() => void handleBulkAction("restore")}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void handleBulkAction("activate")}
                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => void handleBulkAction("pause")}
                    className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => void handleBulkAction("archive")}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Archive
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  setBulkArchiveConfirm(false);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void fetchClients();
          }}
        />
      )}
    </div>
  );
}
