"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";

type ConnectStatus = {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
  stripe_account_id: string | null;
  connected_at: string | null;
};

export function StripeConnectCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Re-fetch on return from Stripe onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "complete" || params.get("stripe") === "refresh") {
      void fetchStatus();
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchStatus]);

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

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // ── State 1: Not connected ──
  if (!status?.connected) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50">
            <CreditCard className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">Stripe Connect</h3>
            <p className="mt-1 text-sm text-gray-500">
              Connect your Stripe account to collect payments from your products.
              Platform fee is based on your plan (Starter 5%, Pro 2%, Enterprise
              0%).
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {connecting ? "Redirecting..." : "Connect Stripe"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── State 2: Onboarding incomplete ──
  if (!status.onboarding_complete || !status.charges_enabled) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">
              Stripe Setup Incomplete
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Your Stripe account is connected but setup is not complete. Please
              finish onboarding to start accepting payments.
            </p>
            {!status.payouts_enabled && status.charges_enabled && (
              <p className="mt-1 text-sm text-yellow-700">
                Stripe needs additional information to enable payouts.
              </p>
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-700 disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {connecting ? "Redirecting..." : "Complete Setup"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── State 3: Fully connected ──
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">Stripe Connected</h3>
          <p className="mt-1 text-sm text-gray-600">
            Your Stripe account is active and ready to accept payments.
          </p>
          <div className="mt-3 space-y-1 text-sm text-gray-500">
            <p>
              Account:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                {status.stripe_account_id}
              </code>
            </p>
            <p>Charges: {status.charges_enabled ? "✅ Enabled" : "❌ Disabled"}</p>
            <p>Payouts: {status.payouts_enabled ? "✅ Enabled" : "⚠️ Pending"}</p>
          </div>
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
          >
            View Stripe Dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
