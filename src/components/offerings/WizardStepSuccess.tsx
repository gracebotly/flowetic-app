"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  RotateCcw,
  Globe,
} from "lucide-react";

type Props = {
  offering: { id?: string; name?: string } | null;
  magicLink: string | null;
  productUrl: string | null;
  accessType: string;
  surfaceType: string;
  clientId?: string;
  onCreateAnother: () => void;
};

export function WizardStepSuccess({
  offering,
  magicLink,
  productUrl,
  accessType,
  surfaceType,
  clientId,
  onCreateAnother,
}: Props) {
  const [copiedMagic, setCopiedMagic] = useState(false);
  const [copiedProduct, setCopiedProduct] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const magicUrl = magicLink ? `${base}${magicLink}` : null;
  const prodUrl = productUrl ? `${base}${productUrl}` : null;

  const label =
    surfaceType === "runner"
      ? "Product"
      : surfaceType === "both"
        ? "Portal + Product"
        : "Portal";

  const handleCopy = async (url: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(url);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="flex flex-col items-center py-4 text-center">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>

      <h2 className="mt-5 text-xl font-bold text-gray-900">{label} Created!</h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        <strong className="text-gray-700">{offering?.name}</strong> is live.
        {accessType === "magic_link"
          ? " Share the link below with your client — no login needed."
          : " Your client can access this via the product URL."}
      </p>

      {/* Magic Link */}
      {magicUrl && (
        <div className="mt-6 w-full max-w-lg">
          <label className="block text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            Client Link
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5">
            <code className="flex-1 truncate px-2 text-left text-sm text-gray-700">
              {magicUrl}
            </code>
            <button
              onClick={() => handleCopy(magicUrl, setCopiedMagic)}
              className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              {copiedMagic ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {clientId && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
          <Globe className="h-4 w-4 flex-shrink-0 text-slate-600" />
          <p className="text-xs text-slate-600">
            This portal is assigned to a client.{" "}
            <a
              href={`/control-panel/clients/${clientId}?tab=offerings`}
              className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
            >
              Get their Hub Link
            </a>
          </p>
        </div>
      )}

      {/* Product URL */}
      {prodUrl && (
        <div className="mt-4 w-full max-w-lg">
          <label className="block text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            Product URL
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5">
            <code className="flex-1 truncate px-2 text-left text-sm text-gray-700">
              {prodUrl}
            </code>
            <button
              onClick={() => handleCopy(prodUrl, setCopiedProduct)}
              className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              {copiedProduct ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* View link(s) */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {magicUrl && (
          <a
            href={magicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View Dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {prodUrl && (
          <a
            href={prodUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View Product Page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Branding hint */}
      <p className="mt-6 text-xs text-gray-400">
        Your client sees your agency&apos;s branding, not Getflowetic&apos;s.{" "}
        <Link
          href="/control-panel/settings?tab=branding"
          className="text-blue-500 hover:text-blue-600"
        >
          Edit branding →
        </Link>
      </p>

      {/* Action buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {offering?.id && (
          <Link
            href={`/control-panel/offerings/${offering.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            View {label}
          </Link>
        )}
        <button
          type="button"
          onClick={onCreateAnother}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <RotateCcw className="h-4 w-4" />
          Create Another (Same Config)
        </button>
        <Link
          href="/control-panel/offerings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Client Portals
        </Link>
      </div>
    </div>
  );
}
