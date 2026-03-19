"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard, ArrowRight } from "lucide-react";

type BillingStatus = {
  plan: string;
  plan_label: string;
  plan_status: string;
  trial_ends_at: string | null;
  has_card_on_file: boolean;
  trial_expired: boolean;
  has_subscription: boolean;
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function TrialBanner() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data) => {
        if (active && data.ok) setStatus(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!status) return null;

  const { plan_status, trial_ends_at, has_card_on_file, trial_expired } = status;

  // Active paid plan — no banner
  if (plan_status === "active") return null;

  // Trialing with card and not expired — no banner
  if (plan_status === "trialing" && has_card_on_file && !trial_expired) return null;

  // Trialing without card, more than 3 days left — no banner
  if (
    plan_status === "trialing" &&
    !has_card_on_file &&
    !trial_expired &&
    trial_ends_at &&
    daysUntil(trial_ends_at) > 3
  ) {
    return null;
  }

  // ── Determine banner message ──────────────────────────────
  let bgClass = "bg-amber-50 border-amber-200";
  let iconColor = "text-amber-600";
  let message = "";
  let ctaLabel = "";
  const ctaHref = "/control-panel/settings?tab=billing";

  if (plan_status === "trialing" && !trial_ends_at && !has_card_on_file) {
    // Pay-now user who never completed checkout — show subscribe banner
    bgClass = "bg-red-50 border-red-200";
    iconColor = "text-red-600";
    message = "Complete your subscription to start using Getflowetic.";
    ctaLabel = "Subscribe";
  } else if (trial_expired) {
    bgClass = "bg-red-50 border-red-200";
    iconColor = "text-red-600";
    message = "Your free trial has expired. Subscribe to keep using Getflowetic.";
    ctaLabel = "Subscribe";
  } else if (plan_status === "trialing" && !has_card_on_file && trial_ends_at) {
    const days = daysUntil(trial_ends_at);
    message = `Your trial expires in ${days} day${days !== 1 ? "s" : ""}. Add a payment method to extend to 14 days.`;
    ctaLabel = "Add Card";
  } else if (plan_status === "past_due") {
    bgClass = "bg-red-50 border-red-200";
    iconColor = "text-red-600";
    message = "Your payment failed. Update your card to avoid interruption.";
    ctaLabel = "Update Card";
  } else if (plan_status === "cancelled") {
    bgClass = "bg-red-50 border-red-200";
    iconColor = "text-red-600";
    message = "Your subscription has been cancelled. Resubscribe to regain access.";
    ctaLabel = "Resubscribe";
  } else {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-3 border-b px-6 py-2.5 ${bgClass}`}
    >
      <AlertTriangle className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <p className="flex-1 text-sm text-gray-700">{message}</p>
      <a
        href={ctaHref}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
      >
        {ctaLabel === "Add Card" ? (
          <CreditCard className="h-3.5 w-3.5" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        {ctaLabel}
      </a>
    </div>
  );
}
