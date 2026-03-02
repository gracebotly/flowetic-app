"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Link2,
  CreditCard,
} from "lucide-react";

interface AssignedOffering {
  id: string;
  name: string;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  token: string | null;
  slug: string | null;
  status: string;
  last_viewed_at: string | null;
}

interface AccessTabProps {
  assignedOfferings: AssignedOffering[];
}

export function AccessTab({ assignedOfferings }: AccessTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [localTokens, setLocalTokens] = useState<Record<string, string | null>>({});

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const getUrl = (o: AssignedOffering): string | null => {
    const token = localTokens[o.id] !== undefined ? localTokens[o.id] : o.token;
    if (o.access_type === "magic_link" && token) {
      return `${baseUrl}/client/${token}`;
    }
    if (o.access_type === "stripe_gate" && o.slug) {
      return `${baseUrl}/products/${o.slug}`;
    }
    return null;
  };

  const copyLink = (url: string, offeringId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(offeringId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRegenerate = async (offeringId: string) => {
    setActionLoading(offeringId);
    const res = await fetch(`/api/offerings/${offeringId}/token`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setLocalTokens((prev) => ({ ...prev, [offeringId]: data.token }));
      }
    }
    setActionLoading(null);
  };

  const handleRevoke = async (offeringId: string) => {
    if (!confirm("Revoke this link? The client will lose access.")) return;
    setActionLoading(offeringId);
    await fetch(`/api/offerings/${offeringId}/token`, { method: "DELETE" });
    setLocalTokens((prev) => ({ ...prev, [offeringId]: null }));
    setActionLoading(null);
  };

  const magicLinks = assignedOfferings.filter((o) => o.access_type === "magic_link");
  const productUrls = assignedOfferings.filter((o) => o.access_type === "stripe_gate");

  if (assignedOfferings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
        No offerings assigned. Assign offerings in the Offerings tab first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {magicLinks.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Link2 className="h-4 w-4" />
            Magic Links
          </h3>
          <div className="mt-2 space-y-2">
            {magicLinks.map((o) => {
              const url = getUrl(o);
              return (
                <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900">{o.name}</div>
                  {url ? (
                    <>
                      <div className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
                        {url}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => copyLink(url, o.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          {copiedId === o.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedId === o.id ? "Copied!" : "Copy"}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                        <button
                          onClick={() => handleRegenerate(o.id)}
                          disabled={actionLoading === o.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${actionLoading === o.id ? "animate-spin" : ""}`} />
                          Regenerate
                        </button>
                        <button
                          onClick={() => handleRevoke(o.id)}
                          disabled={actionLoading === o.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Revoke
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-xs text-amber-600">
                      No token generated. Regenerate from the Offerings detail page.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {productUrls.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <CreditCard className="h-4 w-4" />
            Product URLs
          </h3>
          <div className="mt-2 space-y-2">
            {productUrls.map((o) => {
              const url = getUrl(o);
              return (
                <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900">{o.name}</div>
                  {url ? (
                    <>
                      <div className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
                        {url}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => copyLink(url, o.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          {copiedId === o.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedId === o.id ? "Copied!" : "Copy"}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-xs text-amber-600">No product URL configured.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
