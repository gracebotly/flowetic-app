"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowUpRight } from "lucide-react";
import { StripeConnectCard } from "@/components/settings/StripeConnectCard";
import { UsageMeter } from "@/components/settings/UsageMeter";

type UsageCounts = {
  clients: number;
  offerings: number;
  members: number;
};

// Free tier limits — update when plan tiers are added
const FREE_LIMITS = {
  clients: 5,
  offerings: 10,
  members: 2,
};

export function BillingTab() {
  const [usage, setUsage] = useState<UsageCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [clientsRes, teamRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/settings/team"),
        ]);

        const clientsJson = await clientsRes.json();
        const teamJson = await teamRes.json();

        if (!active) return;

        setUsage({
          clients: Array.isArray(clientsJson.clients)
            ? clientsJson.clients.length
            : 0,
          // Offerings count: we don't have a lightweight count endpoint yet.
          // Phase 5 can add GET /api/settings/usage. For now, show 0.
          offerings: 0,
          members: Array.isArray(teamJson.members)
            ? teamJson.members.length
            : 0,
        });
      } catch {
        if (active) setError("Failed to load usage data.");
      }
      if (active) setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stripe Connect — real component */}
      <StripeConnectCard />

      {/* Usage meters */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Your Plan</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            Starter (Free)
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <UsageMeter
            label="Clients"
            current={usage?.clients ?? 0}
            limit={FREE_LIMITS.clients}
          />
          <UsageMeter
            label="Offerings"
            current={usage?.offerings ?? 0}
            limit={FREE_LIMITS.offerings}
          />
          <UsageMeter
            label="Team Members"
            current={usage?.members ?? 0}
            limit={FREE_LIMITS.members}
          />
        </div>

        <button
          disabled
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 opacity-60 cursor-not-allowed"
        >
          Upgrade Plan
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <p className="mt-1.5 text-xs text-gray-400">Coming in a future update.</p>
      </div>
    </div>
  );
}
