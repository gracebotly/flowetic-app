'use client';

import { useState } from 'react';
import { Loader2, Lock, CreditCard, RefreshCw } from 'lucide-react';

interface PricingGateProps {
  offeringId: string;
  pricingType: string; // 'free' | 'per_run' | 'monthly' | 'usage_based'
  priceCents: number;
  slug: string;
  subscriptionStatus?: string | null; // from offering_customer lookup
  children: React.ReactNode; // the FormWizard to render when unlocked
}

export function PricingGate({
  offeringId,
  pricingType,
  priceCents,
  subscriptionStatus,
  children,
}: PricingGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  // Free offerings pass through immediately
  if (pricingType === 'free') {
    return <>{children}</>;
  }

  // Monthly with active subscription — pass through
  if (pricingType === 'monthly' && subscriptionStatus === 'active') {
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Checkout failed');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const isResubscribe =
    pricingType === 'monthly' &&
    subscriptionStatus &&
    subscriptionStatus !== 'active';

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-gray-200 bg-white p-8">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
          {isResubscribe ? (
            <RefreshCw className="h-6 w-6 text-purple-600" />
          ) : (
            <Lock className="h-6 w-6 text-purple-600" />
          )}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          {isResubscribe
            ? 'Resubscribe to continue'
            : pricingType === 'per_run'
              ? `${formatPrice(priceCents)} per run`
              : `${formatPrice(priceCents)}/month`}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {pricingType === 'per_run'
            ? 'Pay once to run this workflow'
            : isResubscribe
              ? 'Your subscription has ended. Resubscribe for unlimited runs.'
              : 'Subscribe for unlimited runs each month'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
          required
        />
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
        />
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading
          ? 'Redirecting to checkout...'
          : isResubscribe
            ? `Resubscribe — ${formatPrice(priceCents)}/mo`
            : pricingType === 'per_run'
              ? `Pay ${formatPrice(priceCents)} & Run`
              : `Subscribe — ${formatPrice(priceCents)}/mo`}
      </button>
    </div>
  );
}
