"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Loader2 } from "lucide-react";

// Common US/EU timezones
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

type Workspace = {
  id: string;
  name: string;
  plan: string;
  timezone: string;
  created_at: string;
};

export function WorkspaceTab() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Load workspace ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings/workspace");
      const json = await res.json();
      if (json.ok && json.workspace) {
        setWorkspace(json.workspace);
        setEditName(json.workspace.name);
        setEditTimezone(json.workspace.timezone);
      }
      setLoading(false);
    })();
  }, []);

  // ── Save workspace ────────────────────────────────────────
  const handleSave = async () => {
    if (!workspace) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const updates: Record<string, string> = {};
    if (editName.trim() !== workspace.name) updates.name = editName.trim();
    if (editTimezone !== workspace.timezone) updates.timezone = editTimezone;

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      return;
    }

    const res = await fetch("/api/settings/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const json = await res.json();

    if (json.ok && json.workspace) {
      setWorkspace(json.workspace);
      setEditName(json.workspace.name);
      setEditTimezone(json.workspace.timezone);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } else {
      setSaveError(json.code || "Save failed");
    }
    setSaving(false);
  };

  // ── Copy workspace ID ─────────────────────────────────────
  const copyId = () => {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasChanges =
    workspace &&
    (editName.trim() !== workspace.name || editTimezone !== workspace.timezone);

  // ── Plan badge ────────────────────────────────────────────
  const planLabel = (plan: string) => {
    switch (plan) {
      case "free":
        return { text: "Starter (Free)", cls: "bg-gray-100 text-gray-600" };
      case "starter":
        return { text: "Starter", cls: "bg-blue-50 text-blue-700" };
      case "pro":
        return { text: "Pro", cls: "bg-purple-50 text-purple-700" };
      default:
        return { text: plan, cls: "bg-gray-100 text-gray-600" };
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        Failed to load workspace settings.
      </div>
    );
  }

  const plan = planLabel(workspace.plan);

  return (
    <div className="space-y-6">
      {/* Workspace Name */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Workspace Name
        </label>
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Workspace ID */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Workspace ID
        </label>
        <div className="mt-1 flex items-center gap-2">
          <code className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-600">
            {workspace.id}
          </code>
          <button
            onClick={copyId}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Timezone
        </label>
        <select
          value={editTimezone}
          onChange={(e) => setEditTimezone(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Plan (read-only) */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Plan
        </label>
        <div className="mt-1">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${plan.cls}`}>
            {plan.text}
          </span>
        </div>
      </div>

      {/* Created (read-only) */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Created
        </label>
        <p className="mt-1 text-sm text-gray-600">
          {new Date(workspace.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
            hasChanges && !saving
              ? "bg-blue-600 hover:bg-blue-700"
              : "cursor-not-allowed bg-gray-300"
          }`}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saveSuccess && (
          <span className="text-sm font-medium text-emerald-600">Saved!</span>
        )}
        {saveError && (
          <span className="text-sm font-medium text-red-600">{saveError}</span>
        )}
      </div>
    </div>
  );
}
