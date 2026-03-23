"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Link2,
  RefreshCw,
  Trash2,
  Eye,
  Settings,
  Activity,
  Save,
  AlertTriangle,
  Users,
  Pencil,
  Palette,
} from "lucide-react";
import { SurfaceBadge } from "@/components/offerings/SurfaceBadge";
import { AccessBadge } from "@/components/offerings/AccessBadge";
import { ScopedActivityFeed } from "@/components/activity/ScopedActivityFeed";
import { BrandingTab as BrandingTabInline } from "@/components/settings/BrandingTab";

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
  custom_path: string | null;
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

type Tab = "overview" | "preview" | "access" | "activity" | "branding";

const SKELETON_NAMES: Record<string, string> = {
  "voice-performance": "Voice Performance Dashboard",
  "multi-agent-voice": "Multi-Agent Voice Dashboard",
  "workflow-operations": "Workflow Operations Dashboard",
  "roi-summary": "ROI Summary Dashboard",
};

const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  per_run: "Per Run",
  monthly: "Monthly",
  usage_based: "Usage Based",
};

const STATUS_OPTIONS = ["active", "paused", "draft"] as const;


function getLabel(surfaceType: string): string {
  switch (surfaceType) {
    case "runner":
      return "Product";
    case "both":
      return "Portal + Product";
    default:
      return "Portal";
  }
}

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

  // Custom token modal state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [tokenModalError, setTokenModalError] = useState<string | null>(null);

  // Inline token editing state
  const [editingToken, setEditingToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Slug editing state (stripe_gate portals)
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Custom path editing state (clean URLs)
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState("");
  const [pathSaving, setPathSaving] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);

  // Domain state (for custom domain URL generation)
  const [portalBaseUrl, setPortalBaseUrl] = useState<string | null>(null);
  const [customDomainInfo, setCustomDomainInfo] = useState<{
    domain: string;
    verified: boolean;
  } | null>(null);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Load offering ─────────────────────────────────────────
  const loadOffering = useCallback(async () => {
    const res = await fetch(`/api/client-portals/${id}`);
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
    // Fetch tenant domain info for URL generation
    (async () => {
      try {
        const res = await fetch("/api/settings/domains");
        const json = await res.json();
        if (json.ok && json.domain) {
          setCustomDomainInfo({ domain: json.domain, verified: json.verified });
          if (json.verified) {
            setPortalBaseUrl(`https://${json.domain}`);
          }
        }
      } catch {
        // Non-fatal — falls back to window.location.origin
      }
    })();
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
      const res = await fetch(`/api/client-portals/${id}`, {
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
  // Opens modal pre-filled with auto-generated slug
  const openRegenerateModal = () => {
    if (!offering) return;
    const slug = offering.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join("-");
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const rand = Array.from({ length: 5 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    setCustomTokenInput(slug ? `${slug}-${rand}` : rand);
    setTokenModalError(null);
    setShowTokenModal(true);
  };

  const confirmRegenerateToken = async () => {
    if (!offering) return;
    const clean = customTokenInput.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
    if (!clean || clean.length < 3) {
      setTokenModalError("Link must be at least 3 characters (letters, numbers, hyphens only).");
      return;
    }
    setTokenAction("regenerating");
    setTokenModalError(null);
    try {
      const res = await fetch(`/api/client-portals/${id}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customToken: clean }),
      });
      const json = await res.json();
      if (json.ok) {
        setOffering((prev) => (prev ? { ...prev, token: json.token } : prev));
        setShowTokenModal(false);
      } else {
        setTokenModalError("That link is unavailable. Try another.");
      }
    } catch {
      setTokenModalError("Could not save link. Please try again.");
    } finally {
      setTokenAction("idle");
    }
  };

  const regenerateToken = openRegenerateModal;

  const revokeToken = async () => {
    if (!offering) return;
    setTokenAction("revoking");
    try {
      const res = await fetch(`/api/client-portals/${id}/token`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setOffering((prev) => (prev ? { ...prev, token: null } : prev));
      }
    } finally {
      setTokenAction("idle");
    }
  };

  // Inline token editing
  const startEditToken = () => {
    setTokenDraft(offering?.token || "");
    setTokenError(null);
    setEditingToken(true);
  };

  const cancelEditToken = () => {
    setEditingToken(false);
    setTokenError(null);
  };

  const saveInlineToken = async () => {
    if (!offering) return;
    const clean = tokenDraft.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
    if (!clean || clean.length < 3) {
      setTokenError("Link must be at least 3 characters (letters, numbers, hyphens only).");
      return;
    }
    if (clean === offering.token) {
      setEditingToken(false);
      return;
    }
    setTokenSaving(true);
    setTokenError(null);
    try {
      const res = await fetch(`/api/client-portals/${id}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customToken: clean }),
      });
      const json = await res.json();
      if (json.ok) {
        setOffering((prev) => (prev ? { ...prev, token: json.token } : prev));
        setEditingToken(false);
      } else {
        setTokenError("That link is unavailable. Try another.");
      }
    } catch {
      setTokenError("Could not save link. Please try again.");
    } finally {
      setTokenSaving(false);
    }
  };

  // ── Slug editing (stripe_gate) ─────────────────────────────
  const startEditSlug = () => {
    setSlugDraft(offering?.slug || "");
    setSlugError(null);
    setEditingSlug(true);
  };

  const saveSlug = async () => {
    const clean = slugDraft
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    if (clean.length < 3) {
      setSlugError("Slug must be at least 3 characters.");
      return;
    }

    setSlugSaving(true);
    setSlugError(null);
    try {
      const res = await fetch(`/api/client-portals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: clean }),
      });
      const json = await res.json();
      if (json.ok) {
        setOffering((prev) => (prev ? { ...prev, slug: clean } : prev));
        setEditingSlug(false);
      } else if (json.code === "UPDATE_FAILED") {
        setSlugError("That slug is already taken. Try another.");
      } else {
        setSlugError("Could not save slug. Please try again.");
      }
    } catch {
      setSlugError("Could not save slug. Please try again.");
    } finally {
      setSlugSaving(false);
    }
  };

  const cancelEditSlug = () => {
    setEditingSlug(false);
    setSlugError(null);
  };

  // ── Custom path management (Clean URLs) ──────────────────
  const startEditPath = () => {
    setPathDraft(offering?.custom_path || "");
    setEditingPath(true);
    setPathError(null);
  };

  const cancelEditPath = () => {
    setEditingPath(false);
    setPathError(null);
  };

  const savePath = async () => {
    const clean = pathDraft
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (clean.length < 3) {
      setPathError("Path must be at least 3 characters.");
      return;
    }

    setPathSaving(true);
    setPathError(null);

    try {
      const res = await fetch(`/api/client-portals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_path: clean }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setOffering((prev) => (prev ? { ...prev, custom_path: clean } : prev));
        setEditingPath(false);
      } else if (res.status === 409) {
        setPathError("This URL path is already in use by another portal.");
      } else {
        setPathError(json.error || "Could not save path. Please try again.");
      }
    } catch {
      setPathError("Could not save path. Please try again.");
    } finally {
      setPathSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/client-portals/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        router.push("/control-panel/client-portals");
      }
    } finally {
      setDeleting(false);
    }
  };

  // ── Copy helper ───────────────────────────────────────────
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Client URL ────────────────────────────────────────────
  const baseUrl = portalBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const isCustomDomain = portalBaseUrl && !portalBaseUrl.includes("getflowetic.com");

  // Clean URL: use /{custom_path} on custom domains
  const clientUrl = offering
    ? isCustomDomain && offering.custom_path
      ? `${baseUrl}/${offering.custom_path}`
      : offering.access_type === "magic_link" && offering.token
        ? `${baseUrl}/client/${offering.token}`
        : offering.slug
          ? `${baseUrl}/p/${offering.slug}`
          : null
    : null;

  // Fallback URL (always uses default domain paths)
  const defaultBase = typeof window !== "undefined" ? window.location.origin : "https://app.getflowetic.com";
  const fallbackUrl = offering
    ? offering.access_type === "magic_link" && offering.token
      ? `${defaultBase}/client/${offering.token}`
      : offering.slug
        ? `${defaultBase}/p/${offering.slug}`
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
        <p className="text-gray-500">Portal not found.</p>
        <Link href="/control-panel/client-portals" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
          ← Back to Client Portals
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
    { key: "branding", label: "Branding", icon: Palette },
  ];

  const hasChanges =
    editName.trim() !== offering.name ||
    (editDescription || "") !== (offering.description || "") ||
    editStatus !== offering.status;

  return (
    <>
      <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/control-panel/client-portals"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Client Portals
      </Link>

      {/* Title + badges */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{offering.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{getLabel(offering.surface_type)}</p>
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
              placeholder="Add a description for this client portal..."
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

          {/* Client link */}
          {offering.client_id && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <Link
                href={`/control-panel/clients/${offering.client_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                <Users className="h-4 w-4" />
                View Client →
              </Link>
            </div>
          )}

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

            {/* Delete */}
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">This will permanently remove this portal.</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
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
                  ? "Generate a client link in the Access tab to enable preview."
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
          {/* Clean URL section — shown when custom domain is active */}
          {isCustomDomain && offering.custom_path && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Clean URL</h3>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    Custom Domain
                  </span>
                </div>
                {!editingPath && (
                  <button
                    onClick={startEditPath}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
                  >
                    Edit
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                This is the URL your clients see — clean, branded, no platform internals.
              </p>

              {editingPath ? (
                <div className="mt-3">
                  <div className="flex items-center rounded-lg border border-blue-300 bg-white text-sm ring-2 ring-blue-100">
                    <span className="flex-shrink-0 rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-500">
                      {portalBaseUrl?.replace("https://", "")}/
                    </span>
                    <input
                      type="text"
                      value={pathDraft}
                      maxLength={60}
                      onChange={(e) => {
                        setPathDraft(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "-")
                            .replace(/-+/g, "-")
                            .replace(/^-/, "")
                        );
                        setPathError(null);
                      }}
                      autoFocus
                      className="w-full border-0 bg-transparent py-2 pr-3 text-sm outline-none"
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-[11px] ${pathDraft.length > 50 ? "text-amber-600" : "text-gray-400"}`}>
                      {pathDraft.length}/60
                    </span>
                  </div>
                  {pathError && (
                    <p className="mt-1 text-xs text-red-600">{pathError}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={savePath}
                      disabled={pathSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {pathSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={cancelEditPath}
                      disabled={pathSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-3 rounded-lg border border-gray-100 bg-white px-4 py-3">
                    <p className="break-all font-mono text-sm text-gray-700">
                      {clientUrl}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => clientUrl && copyToClipboard(clientUrl)}
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
                      href={clientUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </div>
                  {fallbackUrl && fallbackUrl !== clientUrl && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Default fallback</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-gray-400">{fallbackUrl}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Client Link section */}
          {offering.access_type === "magic_link" && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                {isCustomDomain && offering.custom_path ? "Internal Link (Fallback)" : "Client Link"}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Share this link with your client — no login required.
              </p>

              {offering.token ? (
                <>
                  {editingToken ? (
                    <div className="mt-4">
                      <div className="flex items-center rounded-lg border border-blue-300 bg-white text-sm ring-2 ring-blue-100">
                        <span className="shrink-0 pl-3 pr-1 text-gray-400">/client/</span>
                        <input
                          type="text"
                          value={tokenDraft}
                          maxLength={60}
                          onChange={(e) => {
                            setTokenDraft(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, "-")
                                .replace(/-+/g, "-")
                                .replace(/^-/, "")
                            );
                            setTokenError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveInlineToken();
                            if (e.key === "Escape") cancelEditToken();
                          }}
                          autoFocus
                          className="w-full border-0 bg-transparent py-2.5 pr-3 font-mono text-sm text-gray-900 outline-none"
                        />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`text-[11px] ${tokenDraft.length > 50 ? "text-amber-600" : "text-gray-400"}`}>
                          {tokenDraft.length}/60
                        </span>
                      </div>
                      {tokenError && (
                        <p className="mt-1 text-xs text-red-600">{tokenError}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={saveInlineToken}
                          disabled={tokenSaving}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save className="h-3 w-3" />
                          {tokenSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEditToken}
                          disabled={tokenSaving}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Default domain URL — always shown */}
                      <div className="mt-4">
                        <p className="text-[11px] font-medium text-gray-400">
                          {customDomainInfo ? "Default link" : ""}
                        </p>
                        <div className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                          <p className="break-all font-mono text-sm text-gray-700">
                            {(typeof window !== "undefined" ? window.location.origin : "https://app.getflowetic.com")}/client/{offering.token}
                          </p>
                        </div>
                      </div>

                      {/* Custom domain URL — when configured */}
                      {customDomainInfo && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-medium text-gray-400">Your domain</p>
                            {customDomainInfo.verified ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                Connected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                <span className="h-1 w-1 rounded-full bg-amber-500" />
                                Pending DNS
                              </span>
                            )}
                          </div>
                          <div className={`mt-1.5 rounded-lg border px-4 py-3 ${
                            customDomainInfo.verified
                              ? "border-emerald-100 bg-emerald-50/50"
                              : "border-amber-100 bg-amber-50/30"
                          }`}>
                            <p className={`break-all font-mono text-sm ${
                              customDomainInfo.verified ? "text-gray-700" : "text-gray-400"
                            }`}>
                              https://{customDomainInfo.domain}/client/{offering.token}
                            </p>
                          </div>
                          {!customDomainInfo.verified && (
                            <p className="mt-1 text-[11px] text-amber-600">
                              This URL will work once DNS is configured.{" "}
                              <a
                                href="/control-panel/settings?tab=branding"
                                className="font-medium text-amber-700 hover:text-amber-800"
                              >
                                Check status →
                              </a>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => copyToClipboard(
                            customDomainInfo?.verified
                              ? `https://${customDomainInfo.domain}/client/${offering.token}`
                              : `${baseUrl}/client/${offering.token}`
                          )}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50"
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
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors duration-200 hover:bg-blue-100"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </a>
                        <button
                          onClick={revokeToken}
                          disabled={tokenAction !== "idle"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {tokenAction === "revoking" ? "Revoking…" : "Revoke"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    No active client link. Generate one to share with your client.
                  </p>
                  <button
                    onClick={regenerateToken}
                    disabled={tokenAction !== "idle"}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
                  >
                    <Link2 className="h-4 w-4" />
                    {tokenAction === "regenerating" ? "Generating…" : "Generate Client Link"}
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

              {/* Product URL — editable slug */}
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium text-gray-600">Product URL</p>
                  {offering.slug && !editingSlug && (
                    <button
                      onClick={startEditSlug}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingSlug ? (
                  <div className="mt-1.5">
                    <div className="flex items-center rounded-lg border border-blue-300 bg-white text-sm ring-2 ring-blue-100">
                      <span className="flex-shrink-0 px-3 text-gray-400">/p/</span>
                      <input
                        type="text"
                        value={slugDraft}
                        maxLength={60}
                        onChange={(e) => {
                          setSlugDraft(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                              .replace(/-+/g, "-")
                              .replace(/^-/, "")
                          );
                          setSlugError(null);
                        }}
                        autoFocus
                        className="w-full border-0 bg-transparent py-2 pr-3 text-sm outline-none"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-[11px] ${slugDraft.length > 50 ? "text-amber-600" : "text-gray-400"}`}>
                        {slugDraft.length}/60
                      </span>
                    </div>
                    {slugError && (
                      <p className="mt-1 text-xs text-red-600">{slugError}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={saveSlug}
                        disabled={slugSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {slugSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEditSlug}
                        disabled={slugSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : offering.slug ? (
                  <>
                    <div className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="break-all font-mono text-sm text-gray-700">
                        {baseUrl}/p/{offering.slug}
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => copyToClipboard(`${baseUrl}/p/${offering.slug}`)}
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
                        href={`${baseUrl}/p/${offering.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm text-gray-500">
                    No product URL configured.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Branding                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "branding" && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              Branding applies to <strong>all</strong> your client portals — logo, colors, and footer are set globally.
            </p>
          </div>
          <BrandingTabInline />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Activity                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "activity" && (
        <div className="mt-6">
          <ScopedActivityFeed offeringId={id} limit={50} />
        </div>
      )}
      </div>

      {/* ── Custom Token Modal ──────────────────────────────── */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-gray-900">Customize Your Link</h2>
            <p className="mt-1 text-sm text-gray-500">
              Edit the link your client will use. Letters, numbers, and hyphens only.
            </p>

            <div className="mt-4">
              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <span className="shrink-0 text-gray-400">{baseUrl}/client/</span>
                <input
                  type="text"
                  value={customTokenInput}
                  onChange={(e) => {
                    setCustomTokenInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    setTokenModalError(null);
                  }}
                  className="min-w-0 flex-1 bg-transparent font-mono text-gray-900 focus:outline-none"
                  placeholder="my-client-link"
                  autoFocus
                />
                <button
                  onClick={() => {
                    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
                    const rand = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
                    const slug = (offering?.name ?? "portal").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).slice(0, 2).join("-");
                    setCustomTokenInput(slug ? `${slug}-${rand}` : rand);
                    setTokenModalError(null);
                  }}
                  className="ml-2 shrink-0 text-xs text-blue-500 hover:text-blue-700"
                  title="Randomize suffix"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              {tokenModalError && (
                <p className="mt-1.5 text-xs text-red-600">{tokenModalError}</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowTokenModal(false)}
                disabled={tokenAction === "regenerating"}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmRegenerateToken}
                disabled={tokenAction === "regenerating"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Pencil className="h-3.5 w-3.5" />
                {tokenAction === "regenerating" ? "Saving…" : "Save Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
