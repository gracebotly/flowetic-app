"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ProjectType = "analytics" | "tool" | "form";
type ProjectStatus = "live" | "draft";

type Project = {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  publicEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type TabKey = "overview" | "access" | "preview" | "settings" | "activity";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<ProjectType>("analytics");
  const [draftStatus, setDraftStatus] = useState<ProjectStatus>("draft");
  const [draftDescription, setDraftDescription] = useState("");

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/projects/get?id=${encodeURIComponent(id)}`, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok || !json?.project) {
      setProject(null);
      setErr(json?.message || "Failed to load project.");
      setLoading(false);
      return;
    }
    const p = json.project as Project;
    setProject(p);
    setDraftName(p.name);
    setDraftType(p.type);
    setDraftStatus(p.status);
    setDraftDescription(p.description ?? "");
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const tabs = useMemo(
    () => [
      { key: "overview" as const, label: "Overview" },
      { key: "access" as const, label: "Access" },
      { key: "preview" as const, label: "Preview" },
      { key: "settings" as const, label: "Settings" },
      { key: "activity" as const, label: "Activity" },
    ],
    [],
  );

  async function saveOverview() {
    if (!project) return;
    setLoading(true);
    setErr(null);

    const res = await fetch("/api/projects/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: project.id,
        name: draftName,
        type: draftType,
        status: draftStatus,
        description: draftDescription,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setErr(json?.message || "Failed to save changes.");
      setLoading(false);
      return;
    }

    await load();
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{project?.name || "Project"}</h1>
          <p className="mt-1 text-sm text-gray-600">Manage distribution and settings for this project.</p>
        </div>

        <button
          type="button"
          onClick={() => window.location.assign("/control-panel/projects")}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back to Projects
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === t.key ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {err ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
          ) : null}

          {loading && !project ? <div className="text-sm text-gray-500">Loading…</div> : null}

          {tab === "overview" && project ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Project Name</div>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Type</div>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as ProjectType)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="analytics">Analytics</option>
                    <option value="tool">Tool</option>
                    <option value="form">Form</option>
                  </select>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-900">Status</div>
                  <select
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value as ProjectStatus)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900">Description</div>
                <textarea
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  rows={4}
                />
              </div>

              <div className="text-xs text-gray-500">
                Created: {project.createdAt} • Last updated: {project.updatedAt}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveOverview}
                  disabled={loading}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : null}

          {tab !== "overview" ? (
            <div className="text-sm text-gray-600">
              This tab is implemented as a functional shell. Full Access/Preview/Settings/Activity workflows will be
              added next per spec.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}