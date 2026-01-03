
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
type StepKey = "platform" | "method" | "credentials" | "select" | "done";

const PLATFORM_LABEL: Record<PlatformType, string> = {
  n8n: "n8n",
  make: "Make",
  activepieces: "Activepieces",
  vapi: "Vapi",
  retell: "Retell",
};

function PlatformIcon({ type }: { type: PlatformType }) {
  // Use existing local platform icon components if you have them.
  // Fallback: neutral glyph box (no emojis).
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-slate-700">
      <span className="text-xs font-bold">{PLATFORM_LABEL[type].slice(0, 2).toUpperCase()}</span>
    </div>
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
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${styles}`}>{trigger}</span>;
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

export default function ConnectionsPage() {
  const [tab, setTab] = useState<TabKey>("all");

  const [sources, setSources] = useState<Source[]>([]);
  const [entitiesBySource, setEntitiesBySource] = useState<Record<string, SourceEntity[]>>({});
  const [loading, setLoading] = useState(true);

  // Toolbar state (UI only; filter/sort minimal, wired client-side)
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"last_updated" | "name">("last_updated");

  // Connect modal state (Step 1 + 2 approved)
  const [connectOpen, setConnectOpen] = useState(false);
  const [step, setStep] = useState<StepKey>("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);

  // method selection (3 options only)
  const [selectedMethod, setSelectedMethod] = useState<ConnectionMethod>("api");

  // credentials inputs (Step 1 approved: API key only for n8n, but keep generic for other platforms)
  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");

  // n8n selection (Step 2 approved)
  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Record<string, boolean>>({});
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);

  // UI feedback
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Menu + credentials modal
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [credSource, setCredSource] = useState<Source | null>(null);

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

    // load entities per source (only for connected sources)
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

  const stats = useMemo(() => {
    const allEntities = Object.values(entitiesBySource).flat();
    const totalIndexed = allEntities.length;

    // executions not implemented yet → show muted dashes
    const totalExecutions = null;
    const failedExecutions = null;
    const successRate = null;

    const platformsConnected = sources.length;

    return {
      totalIndexed,
      totalExecutions,
      failedExecutions,
      successRate,
      platformsConnected,
    };
  }, [entitiesBySource, sources]);

  const allRows = useMemo(() => {
    const rows: Array<{
      key: string;
      platform: PlatformType;
      title: string;
      meta: string;
      trigger: "Webhook" | "Schedule" | "Chat" | "Form";
      statusDot: "active" | "inactive";
    }> = [];

    for (const s of sources) {
      const ents = entitiesBySource[s.id] ?? [];
      for (const e of ents) {
        // trigger types: only 4; until we parse triggers from n8n workflow nodes, default to Webhook.
        const trigger: "Webhook" | "Schedule" | "Chat" | "Form" = "Webhook";

        const updated = e.updated_at ? new Date(e.updated_at).toLocaleDateString() : null;
        const created = e.created_at ? new Date(e.created_at).toLocaleDateString() : null;
        const metaParts = [];
        if (updated) metaParts.push(`Updated ${updated}`);
        if (created) metaParts.push(`Created ${created}`);
        const meta = metaParts.join(" • ");

        rows.push({
          key: `${s.id}-${e.external_id}`,
          platform: s.type,
          title: e.display_name,
          meta,
          trigger,
          statusDot: e.enabled_for_analytics ? "active" : "inactive",
        });
      }
    }

    // client-side filter by query
    if (query) {
      const q = query.toLowerCase();
      const filtered = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          PLATFORM_LABEL[r.platform].toLowerCase().includes(q) ||
          r.meta.toLowerCase().includes(q)
      );
      return filtered;
    }

    return rows;
  }, [sources, entitiesBySource, query]);

  // Toolbar UI: If query input, keep it on one line to avoid overflow

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Connections</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Indexed</div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalIndexed}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Executions (24h)</div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalExecutions ?? "--"}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Failed (24h)</div>
          <div className="text-2xl font-bold text-slate-900">{stats.failedExecutions ?? "--"}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Success Rate</div>
          <div className="text-2xl font-bold text-slate-900">{stats.successRate ?? "--"}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Platforms</div>
          <div className="text-2xl font-bold text-slate-900">{stats.platformsConnected}</div>
        </div>
      </div>

      {/* Toolbar with tabs, search, filters */}
      {/* Toolbar: tabs row */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          className={`px-3 py-2 font-medium text-sm ${
            tab === "all" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-600"
          }`}
          onClick={() => setTab("all")}
        >
          All Workflows
        </button>
        <button
          className={`px-3 py-2 font-medium text-sm ${
            tab === "credentials" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-600"
          }`}
          onClick={() => setTab("credentials")}
        >
          API Credentials
        </button>
      </div>

      {/* Toolbar: Search + filters row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search workflows, platforms, dates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Sort
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === "all" && (
        <div className="space-y-4">
          {/* List rows with pagination */}
          <div className="bg-white rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-medium text-slate-700 px-6 py-3">Workflow</th>
                  <th className="text-left font-medium text-slate-700 px-6 py-3">Platform</th>
                  <th className="text-left font-medium text-slate-700 px-6 py-3">Trigger</th>
                  <th className="text-left font-medium text-slate-700 px-6 py-3">Status</th>
                  <th className="text-left font-medium text-slate-700 px-6 py-3">Updated</th>
                  <th className="text-left font-medium text-slate-700 px-6 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.statusDot === "active" ? "#10b981" : "#64748b" }} />
                        <div>
                          <div className="font-medium text-slate-900">{row.title}</div>
                          <div className="text-xs text-slate-500">{row.meta}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <PlatformIcon type={row.platform} />
                        <span className="font-medium text-slate-900">{PLATFORM_LABEL[row.platform]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <TriggerBadge trigger={row.trigger} />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${row.statusDot === "active" ? "bg-green-500" : "bg-slate-400"}`} />
                        <span className="text-slate-700">{row.statusDot === "active" ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{row.meta.split(" • ").find((s) => s.startsWith("Updated"))?.replace("Updated ", "") ?? "--"}</td>
                    <td className="px-6 py-3">
                      <button
                        className="text-slate-400 hover:text-slate-600 p-1"
                        onClick={() => setMenuOpenFor(menuOpenFor === row.key ? null : row.key)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allRows.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                {loading ? "Loading..." : query ? "No workflows found matching your search." : "No workflows indexed yet."}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Showing {allRows.length} workflows</div>
            <div className="flex gap-1">
              <button className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">Previous</button>
              <button className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">1</button>
              <button className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">2</button>
              <button className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">3</button>
              <button className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">Next</button>
            </div>
          </div>
        </div>
      )}

      {tab === "credentials" && (
        <div className="space-y-4">
          {/* API Credentials view with same layout patterns */}
          <div className="text-center py-16">
            <div className="text-slate-500 mb-4">API credential management coming soon</div>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
