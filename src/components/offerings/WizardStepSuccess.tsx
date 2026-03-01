"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Check, ExternalLink, Plus, ArrowLeft } from "lucide-react";

type Props = {
  offering: any;
  magicLink: string | null;
  productUrl: string | null;
  accessType: string;
};

export function WizardStepSuccess({
  offering,
  magicLink,
  productUrl,
  accessType,
}: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? magicLink
        ? `${window.location.origin}${magicLink}`
        : productUrl
          ? `${window.location.origin}${productUrl}`
          : null
      : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center py-4 text-center">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>

      <h2 className="mt-5 text-xl font-bold text-gray-900">
        Offering Created!
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        <strong className="text-gray-700">{offering?.name}</strong> is live.{" "}
        {accessType === "magic_link"
          ? "Share the magic link below with your client — no login needed."
          : "Your client can access this via the product URL."}
      </p>

      {/* Shareable Link */}
      {shareUrl && (
        <div className="mt-6 w-full max-w-lg">
          <label className="block text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            {accessType === "magic_link" ? "Magic Link" : "Product URL"}
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5">
            <code className="flex-1 truncate px-2 text-left text-sm text-gray-700">
              {shareUrl}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* View link */}
      {shareUrl && (
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Open in new tab
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Branding hint */}
      <p className="mt-6 text-xs text-gray-400">
        Your client sees your agency&apos;s branding, not Getflowetic&apos;s.{" "}
        <Link
          href="/control-panel/settings"
          className="text-blue-500 hover:text-blue-600"
        >
          Edit branding in Settings →
        </Link>
      </p>

      {/* Action buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {offering?.id && (
          <Link
            href={`/control-panel/offerings/${offering.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            View Offering
          </Link>
        )}
        <Link
          href="/control-panel/offerings/create"
          onClick={(e) => {
            e.preventDefault();
            window.location.reload();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Another
        </Link>
        <Link
          href="/control-panel/offerings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Offerings
        </Link>
      </div>
    </div>
  );
}
