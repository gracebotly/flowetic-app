"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { validateEmail } from "@/lib/validation/email";

interface CreateClientModalProps {
  onClose: () => void;
  onCreated: () => void;
}

/** Strips all non-digit characters and checks digit count is between 7–15 */
function validatePhone(raw: string): string | null {
  if (!raw.trim()) return null; // phone is optional — empty is fine
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "Phone number is too short.";
  if (digits.length > 15) return "Phone number is too long.";
  return null;
}

export function CreateClientModal({ onClose, onCreated }: CreateClientModalProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline field errors (shown on blur)
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [phoneFieldError, setPhoneFieldError] = useState<string | null>(null);

  // Typo suggestion for email (e.g. "Did you mean gmail.com?")
  const [emailTypoSuggestion, setEmailTypoSuggestion] = useState<string | null>(null);

  const handleEmailBlur = () => {
    if (!email.trim()) {
      setEmailFieldError(null);
      setEmailTypoSuggestion(null);
      return;
    }
    const result = validateEmail(email);
    if (!result.valid) {
      if (result.code === "TYPO_DETECTED") {
        setEmailTypoSuggestion(result.suggestion);
        setEmailFieldError(null);
      } else {
        setEmailFieldError(result.message);
        setEmailTypoSuggestion(null);
      }
    } else {
      setEmailFieldError(null);
      setEmailTypoSuggestion(null);
    }
  };

  const handlePhoneBlur = () => {
    setPhoneFieldError(validatePhone(phone));
  };

  const handleAcceptEmailSuggestion = () => {
    if (emailTypoSuggestion) {
      setEmail(emailTypoSuggestion);
      setEmailTypoSuggestion(null);
      setEmailFieldError(null);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    // Validate email if provided
    if (email.trim()) {
      const emailResult = validateEmail(email);
      if (!emailResult.valid) {
        if (emailResult.code === "TYPO_DETECTED") {
          setEmailTypoSuggestion(emailResult.suggestion);
        } else {
          setEmailFieldError(emailResult.message);
        }
        return;
      }
    }

    // Validate phone if provided
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setPhoneFieldError(phoneError);
      return;
    }

    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        company: company.trim() || undefined,
        contactEmail: email.trim() || undefined,
        contactPhone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      }),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Failed to create client.");
    }
    setSaving(false);
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
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">New Client Account</h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Name (required) */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Client Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dr. Rivera or Apex Roofing"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Rivera Family Dental"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailFieldError) setEmailFieldError(null);
                if (emailTypoSuggestion) setEmailTypoSuggestion(null);
              }}
              onBlur={handleEmailBlur}
              placeholder="hello@riverafamilydental.com"
              className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                emailFieldError
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-blue-300"
              }`}
            />
            {emailFieldError && (
              <p className="mt-1 text-xs text-red-600">{emailFieldError}</p>
            )}
            {emailTypoSuggestion && (
              <p className="mt-1 text-xs text-amber-700">
                Did you mean{" "}
                <button
                  type="button"
                  onClick={handleAcceptEmailSuggestion}
                  className="font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-600"
                >
                  {emailTypoSuggestion}
                </button>
                ?
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneFieldError) setPhoneFieldError(null);
              }}
              onBlur={handlePhoneBlur}
              placeholder="+1 (813) 555-0192"
              className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                phoneFieldError
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-blue-300"
              }`}
            />
            {phoneFieldError && (
              <p className="mt-1 text-xs text-red-600">{phoneFieldError}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="priority, onboarding, ai-voice"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="What's the workflow context? (e.g., missed calls, scheduling)"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
