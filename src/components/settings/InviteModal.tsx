"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  X,
  Mail,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

/** Must match server-side: src/lib/validation/email.ts */
const EMAIL_RE =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

const VALID_ROLES = [
  { value: "viewer", label: "Viewer", description: "Read-only access" },
  { value: "client", label: "Client", description: "Can create and edit client portals" },
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
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Typo suggestion from server
  const [typoSuggestion, setTypoSuggestion] = useState<string | null>(null);

  const [inviteResult, setInviteResult] = useState<{
    email: string;
    role: string;
    tenant_name: string;
    invite_link: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email?.toLowerCase() ?? null);
    });
  }, []);

  const validateEmailField = (value: string): string | null => {
    if (!value.trim()) return null;
    if (!EMAIL_RE.test(value.trim())) return "Please enter a valid email address.";
    return null;
  };

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();

    // Client-side format check
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setEmailFieldError("Please enter a valid email address (e.g. name@company.com).");
      return;
    }

    if (currentUserEmail && trimmed === currentUserEmail) {
      setError("You cannot invite yourself.");
      return;
    }

    setSending(true);
    setError(null);
    setTypoSuggestion(null);

    try {
      const res = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json();

      if (data.ok && data.invite) {
        setInviteResult({
          email: data.invite.email,
          role: data.invite.role,
          tenant_name: data.invite.tenant_name,
          invite_link: data.invite.invite_link,
        });
      } else {
        // Handle typo suggestion from server
        if (data.code === "TYPO_DETECTED" && data.suggestion) {
          setTypoSuggestion(data.suggestion);
          setError(data.message);
          setSending(false);
          return;
        }

        const errorMessages: Record<string, string> = {
          ALREADY_INVITED: "This person already has a pending invite.",
          ALREADY_MEMBER: "This person is already a team member.",
          INVALID_EMAIL: data.message || "Please enter a valid email address.",
          INVALID_ROLE: "Invalid role selected.",
          ADMIN_REQUIRED: "Only admins can invite team members.",
          CANNOT_INVITE_SELF: "You cannot invite yourself.",
          SEAT_LIMIT_REACHED: data.message || "Team seat limit reached. Upgrade your plan.",
        };
        setError(errorMessages[data.code] || data.message || "Failed to send invite.");
      }
    } catch {
      setError("Network error. Please try again.");
    }

    setSending(false);
  };

  const handleAcceptSuggestion = () => {
    if (typoSuggestion) {
      setEmail(typoSuggestion);
      setTypoSuggestion(null);
      setError(null);
      setEmailFieldError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !sending && email.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyLink = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.invite_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {inviteResult ? "Invite Sent" : "Invite Team Member"}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-200 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {inviteResult ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="px-6 py-6"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm text-slate-900">
                  Invite sent to{" "}
                  <span className="font-semibold">{inviteResult.email}</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  They&apos;ll receive an email with a link to join{" "}
                  {inviteResult.tenant_name} as{" "}
                  {VALID_ROLES.find((r) => r.value === inviteResult.role)?.label || inviteResult.role}.
                </p>
              </div>

              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Or share the invite link directly:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-slate-900">
                    {inviteResult.invite_link}
                  </code>
                  <button
                    onClick={copyLink}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 px-6 py-5"
            >
              {/* Email field */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                      if (emailFieldError) setEmailFieldError(null);
                      if (typoSuggestion) setTypoSuggestion(null);
                    }}
                    onBlur={() => setEmailFieldError(validateEmailField(email))}
                    onKeyDown={handleKeyDown}
                    placeholder="teammate@agency.com"
                    autoFocus
                    className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-600 focus:ring-2 focus:ring-blue-100 ${
                      emailFieldError || (error && !typoSuggestion)
                        ? "border-red-300 focus:border-red-400"
                        : "border-gray-200 focus:border-blue-400"
                    }`}
                  />
                </div>
                {emailFieldError && (
                  <p className="mt-1 text-xs text-red-600">{emailFieldError}</p>
                )}
              </div>

              {/* Typo suggestion */}
              {typoSuggestion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <p className="text-sm text-amber-800">
                    Did you mean{" "}
                    <button
                      onClick={handleAcceptSuggestion}
                      className="cursor-pointer font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 transition-colors duration-200 hover:text-amber-700"
                    >
                      {typoSuggestion}
                    </button>
                    ?
                  </p>
                </motion.div>
              )}

              {/* Role selection */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Role
                </label>
                <div className="space-y-2">
                  {VALID_ROLES.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${
                        role === r.value
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                          role === r.value
                            ? "border-blue-600 bg-blue-600"
                            : "border-gray-300"
                        }`}
                      >
                        {role === r.value && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <input
                        type="radio"
                        name="invite-role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={(e) => setRole(e.target.value)}
                        className="sr-only"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{r.label}</p>
                        <p className="text-xs text-slate-600">{r.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* General error (not typo) */}
              {error && !typoSuggestion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          {inviteResult ? (
            <button
              onClick={onInvited}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending || !email.trim()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? "Sending..." : "Send Invite"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
