
"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectType = "analytics" | "tool" | "form";
type ProjectStatus = "live" | "draft";

type ProjectRow = {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  publicEnabled: boolean;
  clientCount: number;
  updatedAt: string;
};

type Filters = {
  q: string;
  type: "all" | ProjectType;
  status: "all" | ProjectStatus;
  public: "all" | "public" | "private";
};

export default function ProjectsPage() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    q: "",
    type: "all",
    status: "all",
    public: "all",
  });

  async function load() {
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams();
    if (filters.q.trim()) qs.set("q", filters.q.trim());
    if (filters.type !== "all") qs.set("type", filters.type);
    if (filters.status !== "all") qs.set("status", filters.status);
    if (filters.public !== "all") qs.set("public", filters.public);

    const res = await fetch(`/api/projects/list?${qs.toString()}`, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setRows([]);
      setErr(json?.message || "Failed to load projects.");
      setLoading(false);
      return;
    }
    setRows((json.projects as ProjectRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.status, filters.public]);

  const displayed = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let r = [...rows];
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q));
    r.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return r;
  }, [rows, filters.q]);

  async function createNewProject() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok || !json?.id) {
      setLoading(false);
      setErr(json?.message || "Failed to create project.");
      return;
    }
    window.location.assign(`/control-panel/projects/${encodeURIComponent(String(json.id))}`);
  }

  function typeBadge(type: ProjectType) {
    if (type === "analytics") return "bg-blue-50 text-blue-700 border-blue-200";
    if (type === "tool") return "bg-yellow-50 text-yellow-800 border-yellow-200";
    return "bg-green-50 text-green-700 border-green-200";
  }

  function typeLabel(type: ProjectType) {
    return type === "analytics" ? "Analytics" : type === "tool" ? "Tool" : "Form";
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">
            Publish, share, monetize. Manage distribution and access for everything you build.
          </p>
        </div>

        <button
          type="button"
          onClick={createNewProject}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          disabled={loading}
        >
          + New Project
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            placeholder="Search projects..."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
          />

          <select
            value={filters.type}
            onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value as any }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All types</option>
            <option value="analytics">Analytics</option>
            <option value="tool">Tool</option>
            <option value="form">Form</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as any }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All status</option>
            <option value="live">Live</option>
            <option value="draft">Draft</option>
          </select>

          <select
            value={filters.public}
            onChange={(e) => setFilters((p) => ({ ...p, public: e.target.value as any }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All access</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Access</div>
            <div className="col-span-2">Updated</div>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading…</div>
          ) : displayed.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No projects found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {displayed.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => window.location.assign(`/control-panel/projects/${encodeURIComponent(p.id)}`)}
                  className="grid w-full grid-cols-12 items-center px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="col-span-4">
                    <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{p.id}</div>
                  </div>

                  <div className="col-span-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${typeBadge(p.type)}`}>
                      {typeLabel(p.type)}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <span className={`h-2 w-2 rounded-full ${p.status === "live" ? "bg-green-500" : "bg-gray-400"}`} />
                      {p.status === "live" ? "Live" : "Draft"}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-sm text-gray-700">
                      {p.publicEnabled ? "🌐 Public" : "Private"}
                      {p.clientCount > 0 ? ` • 👥 ${p.clientCount}` : ""}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-sm text-gray-700">{p.updatedAt}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
