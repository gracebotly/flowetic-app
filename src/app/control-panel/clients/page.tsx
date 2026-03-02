"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { Users, Plus, Search, MoreVertical } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [sortBy, setSortBy] = useState("updated_at");
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("q", search);
    params.set("sort", sortBy);

    const res = await fetch(`/api/clients?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients ?? []);
      setTotalOfferings(data.total_offerings ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await fetchClients();
    };

    void run();
  }, [statusFilter, search, sortBy]);

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
    if (!confirm("Archive this client? Their offerings will be unassigned.")) return;
    await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setMenuOpenId(null);
    await fetchClients();
  };

  const activeCount = clients.filter((c) => c.status === "active").length;
  const pausedCount = clients.filter((c) => c.status === "paused").length;
  const avgHealth =
    clients.length > 0
      ? Math.round(
          clients.reduce((sum, c) => sum + (c.health_score ?? 0), 0) / clients.length
        )
      : 0;

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Clients"
          subtitle="Manage your client accounts and engagement health."
        />
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Client
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
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
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "paused")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
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

      <div className="mt-6 space-y-2">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-sm text-gray-500">Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Users size={64} />}
            title="No clients yet"
            subtitle="Add your first client to start tracking engagement health."
          />
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              onClick={() => router.push(`/control-panel/clients/${client.id}`)}
              className="group relative flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    client.status === "active" ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {client.name}
                    </span>
                    {client.company && (
                      <span className="text-xs text-gray-500 truncate">{client.company}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {client.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="w-32">
                  <HealthBar score={client.health_score ?? 0} />
                </div>
                <div className="text-right w-24">
                  <div className="text-xs text-gray-500">Offerings</div>
                  <div className="text-sm font-medium text-gray-900">{client.offering_count}</div>
                </div>
                <div className="text-right w-24">
                  <div className="text-xs text-gray-500">Last seen</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatRelative(client.last_seen_at)}
                  </div>
                </div>
                <div className="relative">
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
                          void handleArchive(client.id);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {clients.length > 0 && (
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <span>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{activeCount} active</span>
          <span>·</span>
          <span>{pausedCount} paused</span>
          <span>·</span>
          <span>{totalOfferings} active offerings</span>
          <span>·</span>
          <span>Avg health: {avgHealth}</span>
        </div>
      )}

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
