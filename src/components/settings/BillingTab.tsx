"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  ArrowUpRight,
  CreditCard,
  Clock,
  CheckCircle2,
  Info,
} from "lucide-react";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      fetch("/api/billing/status")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setBilling(data);
        })
        .catch(() => {});
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
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center text-sm text-red-600">
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

  // ── Plan badge ──
  let badgeText = planLabel;
  let badgeDotClass = "bg-blue-500";
  let badgeBgClass = "bg-blue-50 text-blue-700";

  if (trialExpired) {
    badgeText = `${planLabel} — Trial expired`;
    badgeDotClass = "bg-red-500";
    badgeBgClass = "bg-red-50 text-red-700";
  } else if (planStatus === "trialing") {
    const days = trialEndsAt ? daysUntil(trialEndsAt) : 0;
    badgeText = `${planLabel} — Trial (${days} day${days !== 1 ? "s" : ""} left)`;
    badgeDotClass = "bg-amber-500";
    badgeBgClass = "bg-amber-50 text-amber-700";
  } else if (planStatus === "active") {
    badgeText = `${planLabel} — Active`;
    badgeDotClass = "bg-emerald-500";
    badgeBgClass = "bg-emerald-50 text-emerald-700";
  } else if (planStatus === "past_due") {
    badgeText = `${planLabel} — Past due`;
    badgeDotClass = "bg-red-500";
    badgeBgClass = "bg-red-50 text-red-700";
  } else if (planStatus === "cancelled") {
    badgeText = `${planLabel} — Cancelled`;
    badgeDotClass = "bg-slate-400";
    badgeBgClass = "bg-slate-100 text-slate-600";
  }

  // ── Plan card border color ──
  const planBorderColor =
    trialExpired || planStatus === "past_due"
      ? "border-l-red-500"
      : planStatus === "trialing"
        ? "border-l-amber-500"
        : planStatus === "active"
          ? "border-l-slate-900"
          : "border-l-slate-300";

  return (
    <div className="space-y-3">
      {/* Stripe Connect */}
      <StripeConnectCard />

      {/* Your Plan */}
      <div
        className={`rounded-lg border border-gray-200 border-l-[3px] bg-white p-5 ${planBorderColor}`}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          Your plan
          <span
            className={`ml-1 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${badgeBgClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badgeDotClass}`} />
            {badgeText}
          </span>
        </div>

        {/* Trial info */}
        {planStatus === "trialing" && !trialExpired && trialEndsAt && (
          <div className="mt-3 flex gap-2 rounded-md bg-slate-50 p-3">
            {hasCard ? (
              <>
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs text-slate-600">
                    Card on file. You won&apos;t be charged until{" "}
                    <span className="font-medium">{formatDate(trialEndsAt)}</span>.
                  </p>
                  {priceCents && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Then ${(priceCents / 100).toFixed(0)}/month.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-600">
                    Add a payment method to extend your trial to 14 days.
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Current trial expires {formatDate(trialEndsAt)}.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Usage meters */}
        {usage && (
          <div className="mt-4 space-y-3">
            <UsageMeter
              label="Client portals"
              current={usage.usage.portals.current}
              limit={
                usage.usage.portals.limit === Infinity
                  ? 999
                  : usage.usage.portals.limit
              }
            />
            <UsageMeter
              label="Team members"
              current={usage.usage.members.current}
              limit={
                usage.usage.members.limit === Infinity
                  ? 999
                  : usage.usage.members.limit
              }
            />
          </div>
        )}

        {/* Platform fee */}
        <p className="mt-3 text-[11px] text-slate-500">
          Platform fee on client payments: {feePercent}%
        </p>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {trialExpired || planStatus === "cancelled" ? (
            <button
              onClick={() => handleSubscribe(currentPlan)}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
            >
              {actionLoading === "subscribe" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Subscribe — $
              {priceCents ? (priceCents / 100).toFixed(0) : "149"}/mo
            </button>
          ) : planStatus === "trialing" && !hasCard ? (
            <button
              onClick={() => handleSubscribe(currentPlan)}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
            >
              {actionLoading === "subscribe" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Add card &amp; extend trial
            </button>
          ) : planStatus === "active" ||
            (planStatus === "trialing" && hasCard) ? (
            <button
              onClick={handlePortal}
              disabled={actionLoading === "portal"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50"
            >
              {actionLoading === "portal" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Manage billing
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : planStatus === "past_due" ? (
            <button
              onClick={handlePortal}
              disabled={actionLoading === "portal"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === "portal" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              Update payment method
            </button>
          ) : null}

          {currentPlan === "agency" &&
            planStatus !== "cancelled" &&
            !trialExpired && (
              <button
                onClick={() => handleSubscribe("scale")}
                disabled={actionLoading === "subscribe"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50"
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
