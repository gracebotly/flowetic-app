"use client";

import { useState } from "react";
import { AlertTriangle, CreditCard, ArrowRight, Loader2 } from "lucide-react";

type Props = {
  reason: "cancelled" | "payment_failed";
  daysRemaining: number;
};

const MESSAGES: Record<string, (days: number) => string> = {
  cancelled: (days) =>
    `Your subscription was cancelled. You have ${days} day${days !== 1 ? "s" : ""} of read-only access remaining before your data becomes inaccessible.`,
  payment_failed: (days) =>
    `Your payment method failed. You have ${days} day${days !== 1 ? "s" : ""} of read-only access remaining. Update your card to restore full access.`,
};

export function SoftBlockBanner({ reason, daysRemaining }: Props) {
  const [loading, setLoading] = useState(false);
  const message = MESSAGES[reason](daysRemaining);
  const isUrgent = daysRemaining <= 7;

  const handleAction = async () => {
    setLoading(true);
    try {
      if (reason === "payment_failed") {
        const res = await fetch("/api/billing/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "agency" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      window.location.href = "/control-panel/settings?tab=billing";
    }
    setLoading(false);
  };

  return (
    <div
      className={`flex items-center gap-3 border-b px-6 py-2.5 ${
        isUrgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <AlertTriangle
        className={`h-4 w-4 shrink-0 ${
          isUrgent ? "text-red-500" : "text-amber-500"
        }`}
      />
      <p className="flex-1 text-sm text-slate-700">{message}</p>
      <button
        onClick={handleAction}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : reason === "payment_failed" ? (
          <CreditCard className="h-3.5 w-3.5" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        {reason === "payment_failed" ? "Update card" : "Resubscribe"}
      </button>
    </div>
  );
}
