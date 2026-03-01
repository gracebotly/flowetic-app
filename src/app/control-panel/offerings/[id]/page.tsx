"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
  Play,
  Layers,
  Link2,
  CreditCard,
  RefreshCw,
  Trash2,
  Eye,
  Settings,
  Activity,
  Save,
  AlertTriangle,
} from "lucide-react";
import { SurfaceBadge } from "@/components/offerings/SurfaceBadge";
import { AccessBadge } from "@/components/offerings/AccessBadge";

// ── Types ───────────────────────────────────────────────────
type Offering = {
  id: string;
  name: string;
  description: string | null;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  skeleton_id: string | null;
  status: string;
  token: string | null;
  slug: string | null;
  pricing_type: string | null;
  price_cents: number | null;
  client_id: string | null;
  source_id: string | null;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  last_viewed_at: string | null;
};

type Tab = "overview" | "preview" | "access" | "activity";

const SKELETON_NAMES: Record<string, string> = {
  "voice-performance": "Voice Performance Dashboard",
  "workflow-operations": "Workflow Operations Dashboard",
  "roi-summary": "ROI Summary Dashboard",
  "combined-overview": "Combined Overview Dashboard",
};

const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  per_run: "Per Run",
  monthly: "Monthly",
  usage_based: "Usage Based",
};

const STATUS_OPTIONS = ["active", "paused", "draft"] as const;

// ── Component ───────────────────────────────────────────────
export default function OfferingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [offering, setOffering] = useState<Offering | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Edit state (Overview tab)
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Token state (Access tab)
  const [tokenAction, setTokenAction] = useState<"idle" | "regenerating" | "revoking">("idle");
  const [copied, setCopied] = useState(false);

  // Archive state
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // ── Load offering ─────────────────────────────────────────
  const loadOffering = useCallback(async () => {
    const res = await fetch(`/api/offerings/${id}`);
    const json = await res.json();
    if (json.ok && json.offering) {
      setOffering(json.offering);
      setEditName(json.offering.name);
      setEditDescription(json.offering.description || "");
      setEditStatus(json.offering.status);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadOffering();
  }, [loadOffering]);

  // ── Save changes (Overview) ───────────────────────────────
  const handleSave = async () => {
    if (!offering) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const updates: Record<string, unknown> = {};
    if (editName.trim() !== offering.name) updates.name = editName.trim();
    if ((editDescription || "") !== (offering.description || "")) updates.description = editDescription.trim() || null;
    if (editStatus !== offering.status) updates.status = editStatus;

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/offerings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (json.ok) {
        setOffering(json.offering);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setSaveError(json.code || "Save failed");
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  };

  // ── Token management (Access) ─────────────────────────────
  const regenerateToken = async () => {
    if (!offering) return;
    setTokenAction("regenerating");
    try {
      const res = await fetch(`/api/offerings/${id}/token`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setOffering((prev) => (prev ? { ...prev, token: json.token } : prev));
      }
    } finally {
      setTokenAction("idle");
    }
  };

  const revokeToken = async () => {
    if (!offering) return;
    setTokenAction("revoking");
    try {
      const res = await fetch(`/api/offerings/${id}/token`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setOffering((prev) => (prev ? { ...prev, token: null } : prev));
      }
    } finally {
      setTokenAction("idle");
    }
  };

  // ── Archive ───────────────────────────────────────────────
  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/offerings/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        router.push("/control-panel/offerings");
      }
    } finally {
      setArchiving(false);
    }
  };

  // ── Copy helper ───────────────────────────────────────────
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Client URL ────────────────────────────────────────────
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const clientUrl = offering
    ? offering.access_type === "magic_link" && offering.token
      ? `${baseUrl}/client/${offering.token}`
      : offering.slug
        ? `${baseUrl}/products/${offering.slug}`
        : null
    : null;

  // ── Loading / Not Found ───────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!offering) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-gray-500">Offering not found.</p>
        <Link href="/control-panel/offerings" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
          ← Back to Offerings
        </Link>
      </div>
    );
  }

  // ── Tab definitions ───────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: typeof Eye }[] = [
    { key: "overview", label: "Overview", icon: Settings },
    { key: "preview", label: "Preview", icon: Eye },
    { key: "access", label: "Access", icon: Link2 },
    { key: "activity", label: "Activity", icon: Activity },
  ];

  const hasChanges =
    editName.trim() !== offering.name ||
    (editDescription || "") !== (offering.description || "") ||
    editStatus !== offering.status;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/control-panel/offerings"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Offerings
      </Link>

      {/* Title + badges */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{offering.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SurfaceBadge surfaceType={offering.surface_type} size="md" />
            <AccessBadge accessType={offering.access_type} size="md" />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                offering.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : offering.status === "draft"
                    ? "bg-gray-100 text-gray-600"
                    : offering.status === "paused"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  offering.status === "active"
                    ? "bg-emerald-500"
                    : offering.status === "draft"
                      ? "bg-gray-400"
                      : offering.status === "paused"
                        ? "bg-amber-500"
                        : "bg-red-500"
                }`}
              />
              {offering.status.charAt(0).toUpperCase() + offering.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Quick copy button in header */}
        {clientUrl && (
          <button
            onClick={() => copyToClipboard(clientUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Overview                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="mt-6 space-y-6">
          {/* Editable name */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Editable description */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              placeholder="Add a description for this offering..."
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Status selector */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Status
            </label>
            <div className="mt-2 flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setEditStatus(s)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    editStatus === s
                      ? s === "active"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : s === "paused"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-gray-300 bg-gray-100 text-gray-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Info grid (read-only) */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Platform</p>
              <p className="mt-1 text-sm font-semibold capitalize text-gray-900">
                {offering.platform_type || "—"}
              </p>
              {offering.skeleton_id && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Dashboard Type
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {SKELETON_NAMES[offering.skeleton_id] || offering.skeleton_id}
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Created</p>
              <p className="mt-1 text-sm text-gray-700">
                {new Date(offering.created_at).toLocaleString()}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                Last Viewed
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {offering.last_viewed_at
                  ? new Date(offering.last_viewed_at).toLocaleString()
                  : "Never"}
              </p>
              {offering.expires_at && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Expires
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {new Date(offering.expires_at).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Pricing (read-only for now) */}
          {offering.access_type === "stripe_gate" && (
            <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Pricing</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {PRICING_LABELS[offering.pricing_type || "free"] || offering.pricing_type}
                {offering.price_cents && offering.price_cents > 0
                  ? ` — $${(offering.price_cents / 100).toFixed(2)}`
                  : ""}
              </p>
            </div>
          )}

          {/* Save + error/success */}
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                hasChanges && !saving
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-100 text-gray-400"
              }`}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : saveSuccess ? "Saved ✓" : "Save Changes"}
            </button>

            {/* Archive */}
            {!archiveConfirm ? (
              <button
                onClick={() => setArchiveConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Archive
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  {archiving ? "Archiving…" : "Yes, archive"}
                </button>
                <button
                  onClick={() => setArchiveConfirm(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Preview                                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "preview" && (
        <div className="mt-6">
          {clientUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This is what your client sees when they open their link.
              </p>
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <iframe
                  src={clientUrl}
                  className="h-[600px] w-full"
                  title="Client preview"
                />
              </div>
              <div className="flex gap-2">
                <a
                  href={clientUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
              <p className="mt-2 text-sm font-medium text-amber-800">
                No client link available
              </p>
              <p className="mt-1 text-sm text-amber-600">
                {offering.access_type === "magic_link"
                  ? "Generate a magic link in the Access tab to enable preview."
                  : "Set up a product slug to enable preview."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Access                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "access" && (
        <div className="mt-6 space-y-6">
          {/* Magic Link section */}
          {offering.access_type === "magic_link" && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Magic Link</h3>
              <p className="mt-1 text-xs text-gray-500">
                Share this link with your client — no login required.
              </p>

              {offering.token ? (
                <>
                  <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="break-all font-mono text-sm text-gray-700">
                      {baseUrl}/client/{offering.token}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/client/${offering.token}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={`${baseUrl}/client/${offering.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                    <button
                      onClick={regenerateToken}
                      disabled={tokenAction !== "idle"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${tokenAction === "regenerating" ? "animate-spin" : ""}`}
                      />
                      {tokenAction === "regenerating" ? "Regenerating…" : "Regenerate"}
                    </button>
                    <button
                      onClick={revokeToken}
                      disabled={tokenAction !== "idle"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {tokenAction === "revoking" ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    No active magic link. Generate one to share with your client.
                  </p>
                  <button
                    onClick={regenerateToken}
                    disabled={tokenAction !== "idle"}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Link2 className="h-4 w-4" />
                    {tokenAction === "regenerating" ? "Generating…" : "Generate Magic Link"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stripe Gate section */}
          {offering.access_type === "stripe_gate" && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Payment Gate</h3>
              <p className="mt-1 text-xs text-gray-500">
                Clients pay before accessing this offering.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Pricing Model
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {PRICING_LABELS[offering.pricing_type || "free"] || offering.pricing_type}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Price
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {offering.price_cents && offering.price_cents > 0
                      ? `$${(offering.price_cents / 100).toFixed(2)}`
                      : "Free"}
                  </p>
                </div>
              </div>

              {offering.slug && (
                <>
                  <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="break-all font-mono text-sm text-gray-700">
                      {baseUrl}/products/{offering.slug}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/products/${offering.slug}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied!" : "Copy URL"}
                    </button>
                    <a
                      href={`${baseUrl}/products/${offering.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Activity                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "activity" && (
        <div className="mt-6">
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Activity className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-900">
              Activity tracking coming soon
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              View counts, access events, and usage analytics for this offering will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
