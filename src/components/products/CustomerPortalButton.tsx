"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

interface Props {
  offeringId: string;
  customerEmail: string;
  returnUrl?: string;
}

export function CustomerPortalButton({ offeringId, customerEmail, returnUrl }: Props) {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId,
          customerEmail,
          returnUrl: returnUrl || window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("[CustomerPortalButton]", data.error);
      }
    } catch (err) {
      console.error("[CustomerPortalButton] Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleManageSubscription}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
      Manage Subscription
    </button>
  );
}
