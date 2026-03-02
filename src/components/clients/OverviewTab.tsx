"use client";

import { useState } from "react";
import {
  Save,
  Check,
  Mail,
  Phone,
  Copy,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { HealthBar } from "@/components/clients/HealthBar";

interface Client {
  id: string;
  name: string;
  company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  tags: string[];
  status: "active" | "paused";
  health_score: number | null;
  last_seen_at: string | null;
  created_at: string;
}

interface OverviewTabProps {
  client: Client;
  assignedOfferingsCount: number;
  totalOfferings: number;
  onUpdated: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

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

function computeBreakdown(client: Client, assignedCount: number, totalCount: number) {
  let recency = 0;
  if (client.last_seen_at) {
    const daysSince = Math.max(0, (Date.now() - new Date(client.last_seen_at).getTime()) / 86400000);
    recency = Math.max(0, Math.round(100 - (daysSince / 30) * 100));
  }

  const engagement = recency > 0 ? Math.min(100, recency + 10) : 0;
  const coverage = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0;
  const status = client.status === "active" ? 100 : 0;
  return { recency, engagement, coverage, status };
}

export function OverviewTab({ client, assignedOfferingsCount, totalOfferings, onUpdated }: OverviewTabProps) {
  const [editName, setEditName] = useState(client.name);
  const [editCompany, setEditCompany] = useState(client.company ?? "");
  const [editEmail, setEditEmail] = useState(client.contact_email ?? "");
  const [editPhone, setEditPhone] = useState(client.contact_phone ?? "");
  const [editNotes, setEditNotes] = useState(client.notes ?? "");
  const [editTags, setEditTags] = useState(client.tags.join(", "));
  const [editStatus, setEditStatus] = useState(client.status);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hasChanges =
    editName !== client.name ||
    editCompany !== (client.company ?? "") ||
    editEmail !== (client.contact_email ?? "") ||
    editPhone !== (client.contact_phone ?? "") ||
    editNotes !== (client.notes ?? "") ||
    editTags !== client.tags.join(", ") ||
    editStatus !== client.status;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const tags = editTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        company: editCompany.trim() || null,
        contact_email: editEmail.trim() || null,
        contact_phone: editPhone.trim() || null,
        notes: editNotes.trim() || null,
        tags,
        status: editStatus,
      }),
    });
    if (res.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onUpdated();
    } else {
      setSaveError("Failed to save changes.");
    }
    setSaving(false);
  };

  const handleArchive = async () => {
    setArchiving(true);
    await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    window.location.href = "/control-panel/clients";
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const breakdown = computeBreakdown(client, assignedOfferingsCount, totalOfferings);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Company</label>
          <input
            type="text"
            value={editCompany}
            onChange={(e) => setEditCompany(e.target.value)}
            placeholder="Company name..."
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Email</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="contact@example.com"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {client.contact_email && (
              <button
                onClick={() => copyToClipboard(client.contact_email, "email")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Copy email"
              >
                {copiedField === "email" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Phone</label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {client.contact_phone && (
              <button
                onClick={() => copyToClipboard(client.contact_phone, "phone")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Copy phone"
              >
                {copiedField === "phone" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Tags</label>
          <input
            type="text"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="vip, dental, trial (comma separated)"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Notes</label>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes about this client..."
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">Status</label>
          <div className="mt-2 flex gap-2">
            {(["active", "paused"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setEditStatus(s)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  editStatus === s
                    ? s === "active"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-gray-100 text-gray-700"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving || !editName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Changes"}
          </button>
        )}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="mt-4 border-t border-gray-100 pt-4">
          {!archiveConfirm ? (
            <button
              onClick={() => setArchiveConfirm(true)}
              className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Archive Client
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Archive? Offerings will be unassigned.</span>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Yes, archive"}
              </button>
              <button
                onClick={() => setArchiveConfirm(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Quick Stats</h3>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500">Offerings</div>
              <div className="text-lg font-semibold text-gray-900">{assignedOfferingsCount}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last Seen</div>
              <div className="text-lg font-semibold text-gray-900">{formatRelative(client.last_seen_at)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Client Since</div>
              <div className="text-lg font-semibold text-gray-900">{formatDate(client.created_at)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Coverage</div>
              <div className="text-lg font-semibold text-gray-900">
                {totalOfferings > 0 ? Math.round((assignedOfferingsCount / totalOfferings) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Health Breakdown</h3>
          <div className="mt-3 space-y-3">
            {[
              { label: "Recency", score: breakdown.recency, weight: "40%" },
              { label: "Engagement", score: breakdown.engagement, weight: "30%" },
              { label: "Coverage", score: breakdown.coverage, weight: "20%" },
              { label: "Status", score: breakdown.status, weight: "10%" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="text-gray-400">{item.weight}</span>
                </div>
                <div className="mt-1">
                  <HealthBar score={item.score} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
