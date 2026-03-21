"use client";

import { useState } from "react";
import { Ban, CreditCard, ArrowRight, Loader2 } from "lucide-react";

type BlockReason = "trial_expired" | "cancelled" | "payment_failed";

const BLOCK_CONTENT: Record<
  BlockReason,
  { title: string; description: string; cta: string }
> = {
  trial_expired: {
    title: "Your free trial has expired",
    description:
      "Your 7-day trial ended and no payment method was added. Subscribe to unlock your control panel and start building client portals.",
    cta: "Subscribe now",
  },
  cancelled: {
    title: "Your subscription has been cancelled",
    description:
      "Your 30-day grace period has ended. Resubscribe to restore full access to your portals, clients, and revenue data.",
    cta: "Resubscribe",
  },
  payment_failed: {
    title: "Your payment method failed",
    description:
      "We were unable to charge your card and the grace period has ended. Update your payment method to restore access.",
    cta: "Update payment method",
  },
};

export function BlockedPage({ reason }: { reason: BlockReason }) {
  const [loading, setLoading] = useState(false);
  const content = BLOCK_CONTENT[reason];

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
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
          <Ban className="h-5 w-5 text-red-500" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{content.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          {content.description}
        </p>
        <button
          onClick={handleAction}
          disabled={loading}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : reason === "payment_failed" ? (
            <CreditCard className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {content.cta}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          Need help?{" "}
          <a
            href="/control-panel/help"
            className="font-medium text-slate-500 underline decoration-slate-300 hover:text-slate-700"
          >
            Contact support
          </a>
          {" · "}
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className="font-medium text-slate-500 underline decoration-slate-300 hover:text-slate-700 disabled:opacity-50"
          >
            Billing settings
          </button>
        </p>
      </div>
    </div>
  );
}
