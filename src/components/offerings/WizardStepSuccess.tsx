"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Palette,
} from "lucide-react";

type Props = {
  offering: { id?: string; name?: string } | null;
  magicLink: string | null;
  productUrl: string | null;
  accessType: string;
  surfaceType: string;
  onCreateAnother: () => void;
  portalBaseUrl?: string;
};

export function WizardStepSuccess({
  offering,
  magicLink,
  productUrl,
  accessType,
  surfaceType,
  onCreateAnother,
  portalBaseUrl,
}: Props) {
  const [copied, setCopied] = useState(false);

  void accessType;

  const base = portalBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const primaryUrl = magicLink
    ? `${base}${magicLink}`
    : productUrl
      ? `${base}${productUrl}`
      : null;

  const urlLabel =
    surfaceType === "runner"
      ? "Product URL"
      : surfaceType === "both"
        ? "Portal Link"
        : "Client Link";

  const label =
    surfaceType === "runner"
      ? "Product"
      : surfaceType === "both"
        ? "Portal + Product"
        : "Portal";

  const handleCopy = async () => {
    if (!primaryUrl) return;
    await navigator.clipboard.writeText(primaryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center py-6 text-center">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>

      <h2 className="mt-5 text-xl font-bold text-gray-900">{label} Created!</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        <span className="font-medium text-gray-700">{offering?.name}</span> is
        live. Share the link below with your client.
      </p>

      {/* Primary URL */}
      {primaryUrl && (
        <div className="mt-7 w-full max-w-lg">
          <label className="mb-1.5 block text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            {urlLabel}
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
            <code className="flex-1 truncate px-2 text-left text-sm text-gray-700">
              {primaryUrl}
            </code>
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              {copied ? (
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

      {/* Branding nudge card */}
      <div className="mt-5 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2.5 text-left">
          <Palette className="h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-xs text-blue-700">
            Customize your portal&apos;s logo, accent colors, and footer in{" "}
            <span className="font-medium">Branding Settings</span>.
          </p>
        </div>
        <Link
          href="/control-panel/settings?tab=branding"
          className="shrink-0 whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Customize →
        </Link>
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onCreateAnother}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Create Another
        </button>
        <Link
          href="/control-panel/offerings"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          View All Portals
        </Link>
      </div>
    </div>
  );
}
