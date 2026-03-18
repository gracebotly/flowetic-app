"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  ArrowRight,
} from "lucide-react";

type ConnectStatus = {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
  details_submitted: boolean;
  stripe_account_id: string | null;
  connected_at: string | null;
};

export function StripeConnectCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/connect/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data: ConnectStatus = await res.json();
      setStatus(data);
    } catch {
      setError("Unable to load Stripe status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("stripe") === "complete" ||
      params.get("stripe") === "refresh"
    ) {
      void fetchStatus();
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchStatus]);

  // Auto-poll when details are submitted but charges not yet enabled
  useEffect(() => {
    if (
      status?.connected &&
      status?.details_submitted &&
      !status?.charges_enabled
    ) {
      setPolling(true);
      const interval = setInterval(() => {
        void fetchStatus();
      }, 5000); // Poll every 5 seconds

      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    } else {
      setPolling(false);
    }
  }, [status?.connected, status?.details_submitted, status?.charges_enabled, fetchStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start Stripe onboarding");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  /* ── State 1: Not connected ── */
  if (!status?.connected) {
    return (
      <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-slate-300 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <CreditCard className="h-4 w-4" />
          Stripe Connect
          <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Not connected
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
          Connect your Stripe account to collect payments from your clients.
          Platform fee is based on your plan.
        </p>
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
        >
          {connecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CreditCard className="h-3.5 w-3.5" />
          )}
          {connecting ? "Redirecting..." : "Connect Stripe"}
        </button>
      </div>
    );
  }

  /* ── State 2a: Details submitted, waiting for Stripe activation ── */
  if (status.details_submitted && !status.charges_enabled) {
    return (
      <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-blue-500 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <CreditCard className="h-4 w-4" />
          Stripe Connect
          <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Activating
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
          Your application has been submitted. Stripe is reviewing and activating
          your account — this usually takes a few moments.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          {polling && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
          <span>{polling ? "Checking status…" : "Waiting for Stripe"}</span>
        </div>
      </div>
    );
  }

  /* ── State 2b: Onboarding incomplete (never submitted or needs more info) ── */
  if (!status.onboarding_complete || !status.charges_enabled) {
    return (
      <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-amber-500 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <CreditCard className="h-4 w-4" />
          Stripe Connect
          <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Setup incomplete
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
          Your Stripe account is connected but setup is not complete.
          Finish onboarding to start accepting payments.
        </p>
        {!status.payouts_enabled && status.charges_enabled && (
          <p className="mt-1 text-xs text-amber-600">
            Stripe needs additional information to enable payouts.
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
        >
          {connecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          {connecting ? "Redirecting..." : "Complete setup"}
        </button>
      </div>
    );
  }

  /* ── State 3: Fully connected ── */
  return (
    <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-emerald-500 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <CreditCard className="h-4 w-4" />
        Stripe Connect
        <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Connected
        </span>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Your Stripe account is active and ready to accept payments.
      </p>

      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-[11px] text-slate-500">Account</p>
          <p className="mt-0.5 font-mono text-xs font-medium text-slate-900">
            {status.stripe_account_id}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Charges</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-900">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Enabled
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Payouts</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-900">
            {status.payouts_enabled ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Enabled
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Pending
              </>
            )}
          </p>
        </div>
      </div>

      <a
        href="https://dashboard.stripe.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50"
      >
        View Stripe dashboard
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
