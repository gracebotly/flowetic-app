"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";

// Matches DB CHECK constraint: ['admin', 'client', 'viewer']
const VALID_ROLES = [
  { value: "viewer", label: "Viewer", description: "Read-only access" },
  { value: "client", label: "Client", description: "Can create/edit offerings and clients" },
  { value: "admin", label: "Admin", description: "Full access including team and billing" },
];

interface InviteModalProps {
  onClose: () => void;
  onInvited: () => void;
}

export function InviteModal({ onClose, onInvited }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state — show invite link
  const [inviteResult, setInviteResult] = useState<{
    invite_link: string;
    email: string;
    note?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setSending(true);
    setError(null);

    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const json = await res.json();

    if (json.ok && json.invite) {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      setInviteResult({
        invite_link: `${baseUrl}${json.invite.invite_link}`,
        email: json.invite.email,
        note: json.invite.note,
      });
    } else {
      const errorMessages: Record<string, string> = {
        ALREADY_INVITED: "This email has already been invited.",
        ALREADY_MEMBER: "This email is already a team member.",
        INVALID_EMAIL: "Please enter a valid email address.",
        INVALID_ROLE: "Invalid role selected.",
        ADMIN_REQUIRED: "Only admins can invite team members.",
      };
      setError(errorMessages[json.code] || json.code || "Failed to send invite.");
    }
    setSending(false);
  };

  const copyLink = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.invite_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {inviteResult ? "Invite Sent" : "Invite Team Member"}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {inviteResult ? (
          /* ── Success: show invite link ─────────────────────── */
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              Invite created for <span className="font-medium text-gray-900">{inviteResult.email}</span>.
              Share this link with them:
            </p>

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <code className="flex-1 truncate text-sm text-gray-700">
                {inviteResult.invite_link}
              </code>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {inviteResult.note && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {inviteResult.note}
              </p>
            )}
          </div>
        ) : (
          /* ── Form: email + role ────────────────────────────── */
          <div className="space-y-4 px-6 py-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@agency.com"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
                Role
              </label>
              <div className="mt-2 space-y-2">
                {VALID_ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                      role === r.value
                        ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={(e) => setRole(e.target.value)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.label}</p>
                      <p className="text-xs text-gray-500">{r.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          {inviteResult ? (
            <button
              onClick={onInvited}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending || !email.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Invite"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
