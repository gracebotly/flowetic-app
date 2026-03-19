"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Info,
  Loader2,
  Receipt,
} from "lucide-react";
import { StripeConnectCard } from "@/components/settings/StripeConnectCard";
import { CancelPlanModal } from "@/components/billing/CancelPlanModal";
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
  cancel_at: string | null;
};

type PaymentMethod = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

type Invoice = {
  id: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

type BillingDetails = {
  ok: boolean;
  subscription: {
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    created: string | null;
    cancel_at_period_end: boolean;
    cancel_at: string | null;
    trial_end: string | null;
  } | null;
  payment_method: PaymentMethod | null;
  invoices: Invoice[];
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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function BillingTab() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [details, setDetails] = useState<BillingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [usageRes, billingRes, detailsRes] = await Promise.all([
          fetch("/api/settings/usage"),
          fetch("/api/billing/status"),
          fetch("/api/billing/details"),
        ]);

        const usageJson: UsageData = await usageRes.json();
        const billingJson: BillingStatus = await billingRes.json();
        const detailsJson: BillingDetails = await detailsRes.json();

        if (!active) return;

        if (usageJson.ok) setUsage(usageJson);
        if (billingJson.ok) setBilling(billingJson);
        if (detailsJson.ok) setDetails(detailsJson);
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
      Promise.all([
        fetch("/api/billing/status").then((r) => r.json() as Promise<BillingStatus>),
        fetch("/api/billing/details").then((r) => r.json() as Promise<BillingDetails>),
      ])
        .then(([statusData, detailsData]) => {
          if (statusData.ok) setBilling(statusData);
          if (detailsData.ok) setDetails(detailsData);
        })
        .catch(() => {});
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    const plan = params.get("plan");

    if (intent === "subscribe" && (plan === "agency" || plan === "scale")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("intent");
      url.searchParams.delete("plan");
      window.history.replaceState({}, "", url.toString());

      const autoSubscribe = async () => {
        setActionLoading("subscribe");
        try {
          const res = await fetch("/api/billing/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan, skipTrial: true }),
          });
          const data: { url?: string; error?: string } = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
          if (data.error) setError(data.error);
        } catch {
          setError("Failed to start subscription. Please try the subscribe button below.");
        }
        setActionLoading(null);
      };

      void autoSubscribe();
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
      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error) setError(data.error);
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
      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to open billing portal.");
    }
    setActionLoading(null);
  };

  const handleResubscribe = async () => {
    setActionLoading("resubscribe");
    try {
      const res = await fetch("/api/billing/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (data.ok) {
        window.location.reload();
        return;
      }
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to resubscribe.");
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

  let badgeText = planLabel;
  let badgeDotClass = "bg-blue-500";
  let badgeBgClass = "bg-blue-50 text-blue-700";

  if (trialExpired) {
    badgeText = "Trial expired";
    badgeDotClass = "bg-red-500";
    badgeBgClass = "bg-red-50 text-red-700";
  } else if (planStatus === "trialing" && !trialEndsAt && !hasCard) {
    // Pay-now user who never completed checkout — no trial was given
    badgeText = "Payment required";
    badgeDotClass = "bg-red-500";
    badgeBgClass = "bg-red-50 text-red-700";
  } else if (planStatus === "trialing") {
    const days = trialEndsAt ? daysUntil(trialEndsAt) : 0;
    badgeText = `Trial · ${days}d left`;
    badgeDotClass = "bg-amber-500";
    badgeBgClass = "bg-amber-50 text-amber-700";
  } else if (planStatus === "active") {
    badgeText = "Active";
    badgeDotClass = "bg-emerald-500";
    badgeBgClass = "bg-emerald-50 text-emerald-700";
  } else if (planStatus === "past_due") {
    badgeText = "Past due";
    badgeDotClass = "bg-red-500";
    badgeBgClass = "bg-red-50 text-red-700";
  } else if (planStatus === "cancelling") {
    badgeText = "Cancelling";
    badgeDotClass = "bg-amber-500";
    badgeBgClass = "bg-amber-50 text-amber-700";
  } else if (planStatus === "cancelled") {
    badgeText = "Cancelled";
    badgeDotClass = "bg-slate-400";
    badgeBgClass = "bg-slate-100 text-slate-600";
  }

  const sub = details?.subscription;
  const pm = details?.payment_method;
  const invoices = details?.invoices ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Subscription</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{planLabel} plan</h3>
            <p className="mt-1 text-sm text-slate-500">
              {priceCents ? `$${(priceCents / 100).toFixed(0)}/month · Billed monthly` : "Custom pricing"}
              {feePercent > 0 ? ` · ${feePercent}% platform fee` : ""}
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${badgeBgClass}`}>
            <span className={`h-2 w-2 rounded-full ${badgeDotClass}`} />
            {badgeText}
          </div>
        </div>

        {sub?.current_period_end && planStatus === "active" && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            Next billing: <span className="font-medium text-slate-800">{formatDate(sub.current_period_end)}</span>
          </div>
        )}

        {sub && (planStatus === "active" || planStatus === "trialing" || planStatus === "cancelling") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Subscribed</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{sub.created ? formatDate(sub.created) : "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Current period</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {sub.current_period_start && sub.current_period_end
                  ? `${formatShortDate(sub.current_period_start)} – ${formatShortDate(sub.current_period_end)}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Platform fee</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{feePercent}%</p>
            </div>
          </div>
        )}

        {planStatus === "trialing" && !trialExpired && trialEndsAt && (
          <div className="mt-4 flex gap-2 rounded-lg bg-slate-50 p-3">
            {hasCard ? (
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm text-slate-700">Card on file. You won&apos;t be charged until {formatDate(trialEndsAt)}.</p>
                  {priceCents ? <p className="text-xs text-slate-500">Then ${(priceCents / 100).toFixed(0)}/month.</p> : null}
                </div>
              </>
            ) : (
              <>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-700">Add a payment method to extend your trial to 14 days.</p>
                  <p className="text-xs text-slate-500">Current trial expires {formatDate(trialEndsAt)}.</p>
                </div>
              </>
            )}
          </div>
        )}

        {planStatus === "cancelling" && billing?.cancel_at && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Your plan ends on {formatDate(billing.cancel_at)}</p>
            <p className="mt-0.5 text-xs text-amber-700">You have full access until then. Changed your mind?</p>
            <button
              onClick={handleResubscribe}
              disabled={actionLoading === "resubscribe"}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {actionLoading === "resubscribe" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Keep my plan
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {(trialExpired || planStatus === "cancelled") && (
            <button
              onClick={() => handleSubscribe(currentPlan)}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {actionLoading === "subscribe" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Subscribe — ${priceCents ? (priceCents / 100).toFixed(0) : "149"}/mo
            </button>
          )}

          {planStatus === "trialing" && !hasCard && (
            <button
              onClick={() => handleSubscribe(currentPlan)}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {actionLoading === "subscribe" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Add card &amp; extend trial
            </button>
          )}

          {planStatus === "past_due" && (
            <button
              onClick={handlePortal}
              disabled={actionLoading === "portal"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === "portal" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Update payment method
            </button>
          )}

          {currentPlan === "agency" && planStatus !== "cancelled" && !trialExpired && (
            <button
              onClick={() => handleSubscribe("scale")}
              disabled={actionLoading === "subscribe"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Upgrade to Scale — $299/mo
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}

          {(planStatus === "active" || (planStatus === "trialing" && hasCard)) && (
            <>
              <button
                onClick={handlePortal}
                disabled={actionLoading === "portal"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {actionLoading === "portal" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Manage billing
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-red-600"
              >
                Cancel plan
              </button>
            </>
          )}
        </div>
      </div>

      {usage && (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <UsageMeter
            label="Client portals"
            current={usage.usage.portals.current}
            limit={usage.usage.portals.limit === Infinity ? 999 : usage.usage.portals.limit}
          />
          <UsageMeter
            label="Team members"
            current={usage.usage.members.current}
            limit={usage.usage.members.limit === Infinity ? 999 : usage.usage.members.limit}
          />
        </div>
      )}

      <StripeConnectCard />

      {(pm || planStatus === "active" || planStatus === "trialing") && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CreditCard className="h-4 w-4" />
            Payment method
          </h4>
          {pm ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{capitalizeFirst(pm.brand)}</p>
                <p className="text-xs text-slate-600">•••• •••• •••• {pm.last4}</p>
                <p className="text-xs text-slate-500">Expires {String(pm.exp_month).padStart(2, "0")}/{pm.exp_year}</p>
              </div>
              <button
                onClick={handlePortal}
                disabled={actionLoading === "portal"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {actionLoading === "portal" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Update
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No payment method on file.</p>
          )}
        </div>
      )}

      {invoices.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Receipt className="h-4 w-4" />
            Invoice history
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 text-slate-700">{formatDate(inv.created)}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{formatCurrency(inv.amount_paid, inv.currency)}</td>
                    <td className="py-3 pr-4">
                      {inv.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          <Clock className="h-3 w-3" />
                          {capitalizeFirst(inv.status ?? "open")}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {inv.invoice_pdf ? (
                        <a
                          href={inv.invoice_pdf}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </a>
                      ) : inv.hosted_invoice_url ? (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CancelPlanModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onCancelled={() => {
          setShowCancelModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
