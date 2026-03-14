"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowUpRight, CreditCard, Clock, CheckCircle2 } from "lucide-react";
import { StripeConnectCard } from "@/components/settings/StripeConnectCard";
import { UsageMeter } from "@/components/settings/UsageMeter";

type UsageData = {
  ok: boolean;
  plan: string;
  plan_status: string;
  trial_ends_at: string | null;
  has_card_on_file: boolean;
  usage: {
    portals: { current: number; limit: number };
    members: { current: number; limit: number };
    clients: { current: number };
  };
  platform_fee_percent: number;
};

type BillingStatus = {
  ok: boolean;
  plan: string;
  plan_label: string;
  plan_status: string;
  trial_ends_at: string | null;
  has_card_on_file: boolean;
  trial_expired: boolean;
  has_subscription: boolean;
  price_cents: number | null;
  platform_fee_percent: number;
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingTab() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [usageRes, billingRes] = await Promise.all([
          fetch("/api/settings/usage"),
          fetch("/api/billing/status"),
        ]);

        const usageJson = await usageRes.json();
        const billingJson = await billingRes.json();

        if (!active) return;

        if (usageJson.ok) setUsage(usageJson);
        if (billingJson.ok) setBilling(billingJson);
      } catch {
        if (active) setError("Failed to load billing data.");
      }
      if (active) setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  // Re-fetch after returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      // Refetch billing status after successful checkout
      fetch("/api/billing/status")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setBilling(data);
        })
        .catch(() => {});
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleSubscribe = async (plan: string) => {
    setActionLoading("subscribe");
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Failed to start subscription.");
    }
    setActionLoading(null);
  };

  const handlePortal = async () => {
    setActionLoading("portal");
    try {
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
      if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Failed to open billing portal.");
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {error}
        <button
          onClick={() => setError(null)}
          className="ml-3 text-red-700 underline hover:no-underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const planLabel = billing?.plan_label ?? "Agency";
  const planStatus = billing?.plan_status ?? "trialing";
  const trialExpired = billing?.trial_expired ?? false;
  const hasCard = billing?.has_card_on_file ?? false;
  const trialEndsAt = billing?.trial_ends_at;
  const priceCents = billing?.price_cents;
  const feePercent = billing?.platform_fee_percent ?? 5;
  const currentPlan = billing?.plan ?? "agency";

  // ── Determine plan badge ──────────────────────────────────
  let badgeText = planLabel;
  let badgeClass = "bg-blue-100 text-blue-700";

  if (trialExpired) {
    badgeText = `${planLabel} — Trial Expired`;
    badgeClass = "bg-red-100 text-red-700";
  } else if (planStatus === "trialing") {
    const days = trialEndsAt ? daysUntil(trialEndsAt) : 0;
    badgeText = `${planLabel} — Trial (${days} day${days !== 1 ? "s" : ""} left)`;
    badgeClass = "bg-amber-100 text-amber-700";
  } else if (planStatus === "active") {
    badgeText = planLabel;
    badgeClass = "bg-green-100 text-green-700";
  } else if (planStatus === "past_due") {
    badgeText = `${planLabel} — Past Due`;
    badgeClass = "bg-red-100 text-red-700";
  } else if (planStatus === "cancelled") {
    badgeText = `${planLabel} — Cancelled`;
    badgeClass = "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-8">
      {/* Stripe Connect — for collecting from agency's clients */}
      <StripeConnectCard />

      {/* Plan + Usage */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Your Plan</h3>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
          >
            {badgeText}
          </span>
        </div>

        {/* Trial info */}
        {planStatus === "trialing" && !trialExpired && trialEndsAt && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            {hasCard ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <div>
                  <p className="text-sm text-gray-700">
                    Card on file. You won&apos;t be charged until{" "}
                    <span className="font-medium">{formatDate(trialEndsAt)}</span>.
                  </p>
                  {priceCents && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Then ${(priceCents / 100).toFixed(0)}/month.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm text-gray-700">
                    Add a payment method to extend your trial to 14 days.
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Current trial expires {formatDate(trialEndsAt)}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Usage meters */}
        {usage && (
          <div className="mt-6 space-y-4">
            <UsageMeter
              label="Client Portals"
              current={usage.usage.portals.current}
              limit={usage.usage.portals.limit === Infinity ? 999 : usage.usage.portals.limit}
            />
            <UsageMeter
              label="Team Members"
              current={usage.usage.members.current}
              limit={usage.usage.members.limit === Infinity ? 999 : usage.usage.members.limit}
            />
          </div>
        )}

        {/* Platform fee info */}
        <div className="mt-4 text-xs text-gray-500">
          Platform fee on client payments: {feePercent}%
        </div>

        {/* CTA buttons — now wired to real API calls */}
        <div className="mt-6 flex flex-wrap gap-3">
          {trialExpired || planStatus === "cancelled" ? (
            <button
              onClick={() => handleSubscribe(currentPlan)}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading === "subscribe" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Subscribe — ${priceCents ? (priceCents / 100).toFixed(0) : "149"}/mo
            </button>
          ) : planStatus === "trialing" && !hasCard ? (
            <button
              onClick={() => handleSubscribe(currentPlan)}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading === "subscribe" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Add Card &amp; Extend Trial
            </button>
          ) : planStatus === "active" || (planStatus === "trialing" && hasCard) ? (
            <button
              onClick={handlePortal}
              disabled={actionLoading === "portal"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {actionLoading === "portal" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Manage Billing
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : planStatus === "past_due" ? (
            <button
              onClick={handlePortal}
              disabled={actionLoading === "portal"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === "portal" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Update Payment Method
            </button>
          ) : null}

          {currentPlan === "agency" &&
            planStatus !== "cancelled" &&
            !trialExpired && (
              <button
                onClick={() => handleSubscribe("scale")}
                disabled={actionLoading === "subscribe"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Upgrade to Scale — $299/mo
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
