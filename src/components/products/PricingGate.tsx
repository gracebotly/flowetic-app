'use client';

import { useState } from 'react';
import { Loader2, Lock, CreditCard, RefreshCw } from 'lucide-react';

interface PricingGateProps {
  offeringId: string;
  pricingType: string;
  priceCents: number;
  slug: string;
  subscriptionStatus?: string | null;
  dashboardToken?: string | null;
  children: React.ReactNode;
}

export function PricingGate({
  offeringId,
  pricingType,
  priceCents,
  subscriptionStatus,
  dashboardToken,
  children,
}: PricingGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  if (pricingType === 'free') {
    return <>{children}</>;
  }

  if (pricingType === 'monthly' && subscriptionStatus === 'active') {
    // If we have a dashboard token, redirect to it — don't render empty children
    if (dashboardToken) {
      if (typeof window !== 'undefined') {
        window.location.href = `/client/${dashboardToken}`;
      }
      return (
        <div className="py-12 text-center text-sm text-slate-500">
          Redirecting to your dashboard…
        </div>
      );
    }
    return <>{children}</>;
  }

  const handleCheckout = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringId,
          customerEmail: email,
          customerName: name || undefined,
          // Tell checkout where to redirect after payment
          dashboardToken: dashboardToken || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Checkout failed');
      }

      const { url } = await res.json();
      // Store email in cookie so returning subscribers are recognized
      if (email) {
        document.cookie = `gf_sub_${offeringId}=${encodeURIComponent(email)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      }
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);

  const isResubscribe =
    pricingType === 'monthly' &&
    subscriptionStatus &&
    subscriptionStatus !== 'active';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
          {isResubscribe ? (
            <RefreshCw className="h-4 w-4 text-slate-600" />
          ) : (
            <Lock className="h-4 w-4 text-slate-600" />
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          {isResubscribe
            ? 'Resubscribe to continue'
            : pricingType === 'per_run'
              ? `${formatPrice(priceCents)} per run`
              : `${formatPrice(priceCents)}/month`}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {pricingType === 'per_run'
            ? 'Pay once to run this workflow'
            : isResubscribe
              ? 'Your subscription has ended. Resubscribe to continue.'
              : dashboardToken
                ? 'Subscribe for full dashboard access'
                : 'Subscribe for unlimited runs each month'}
        </p>
      </div>

      <div className="space-y-2.5">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors duration-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
          required
        />
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors duration-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
        />
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-red-600">{error}</p>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CreditCard className="h-3.5 w-3.5" />
        )}
        {loading
          ? 'Redirecting to checkout...'
          : isResubscribe
            ? `Resubscribe — ${formatPrice(priceCents)}/mo`
            : pricingType === 'per_run'
              ? `Pay ${formatPrice(priceCents)} and run`
              : `Subscribe — ${formatPrice(priceCents)}/mo`}
      </button>
    </div>
  );
}
