"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

type CancelReason =
  | "too_expensive"
  | "missing_features"
  | "not_using_enough"
  | "switching_competitor"
  | "temporary_pause"
  | "other";

const REASONS: { value: CancelReason; label: string }[] = [
  { value: "too_expensive", label: "Too expensive for what I get" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "not_using_enough", label: "Not using it enough" },
  { value: "switching_competitor", label: "Switching to a competitor" },
  { value: "temporary_pause", label: "Just need a temporary pause" },
  { value: "other", label: "Other" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
};

export function CancelPlanModal({ open, onClose, onCancelled }: Props) {
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCancel = async () => {
    if (!selectedReason) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel subscription.");
        setLoading(false);
        return;
      }
      onCancelled();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Cancel your plan</h3>
            <p className="mt-1 text-xs text-slate-500">
              We&apos;d love to understand why. Your feedback helps us improve.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedReason(r.value)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors duration-200 ${
                selectedReason === r.value
                  ? "border-blue-500 bg-blue-50 text-slate-900"
                  : "border-gray-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  selectedReason === r.value ? "border-blue-500" : "border-slate-300"
                }`}
              >
                {selectedReason === r.value && (
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                )}
              </span>
              {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Tell us more (optional)..."
          rows={2}
          className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-200 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
        />

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs leading-relaxed text-slate-500">
            After cancelling, you&apos;ll have 30 days of read-only access to view
            your existing data. After that, your account will be fully locked.
            You can resubscribe at any time to restore full access.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50"
          >
            Keep my plan
          </button>
          <button
            onClick={handleCancel}
            disabled={!selectedReason || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Cancel plan
          </button>
        </div>
      </div>
    </div>
  );
}
