"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Globe,
} from "lucide-react";
import { trackPortalShared } from "@/lib/analytics/events";

type DomainInfo = {
  domain: string;
  verified: boolean;
};

type Props = {
  offering: { id?: string; name?: string } | null;
  magicLink: string | null;
  productUrl: string | null;
  customPath?: string;
  accessType: string;
  surfaceType: string;
  onCreateAnother: () => void;
  portalBaseUrl?: string;
  customDomainInfo?: DomainInfo | null;
};

export function WizardStepSuccess({
  offering,
  magicLink,
  productUrl,
  accessType,
  surfaceType,
  onCreateAnother,
  customPath,
  customDomainInfo,
}: Props) {
  const [copiedDefault, setCopiedDefault] = useState(false);
  const [copiedCustom, setCopiedCustom] = useState(false);

  void accessType;

  const defaultBase =
    typeof window !== "undefined" ? window.location.origin : "https://app.getflowetic.com";
  const path = magicLink || productUrl || null;

  const defaultUrl = path ? `${defaultBase}${path}` : null;

  // On custom domains, use /{customPath} instead of /client/{token} or /p/{slug}
  const cleanPath = customPath ? `/${customPath}` : path;
  const customUrl =
    customDomainInfo?.domain && cleanPath
      ? `https://${customDomainInfo.domain}${cleanPath}`
      : null;

  const hasVerifiedDomain = customDomainInfo?.verified === true;
  const hasPendingDomain = !!customDomainInfo?.domain && !customDomainInfo.verified;

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

  const handleCopyDefault = async () => {
    if (!defaultUrl) return;
    await navigator.clipboard.writeText(defaultUrl);
    if (magicLink) trackPortalShared("magic_link");
    setCopiedDefault(true);
    setTimeout(() => setCopiedDefault(false), 2000);
  };

  const handleCopyCustom = async () => {
    if (!customUrl) return;
    await navigator.clipboard.writeText(customUrl);
    if (magicLink) trackPortalShared("magic_link");
    setCopiedCustom(true);
    setTimeout(() => setCopiedCustom(false), 2000);
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

      {/* ── URL Section ── */}
      {defaultUrl && (
        <div className="mt-7 w-full max-w-lg text-left">
          {/* ── Scenario C: Domain verified — custom URL primary ── */}
          {hasVerifiedDomain && customUrl && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Your domain
                </label>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  Connected
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/30 p-2">
                <code className="flex-1 truncate px-2 text-sm text-gray-700">
                  {customUrl}
                </code>
                <a
                  href={customUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors duration-200 hover:bg-white/60 hover:text-gray-600"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={handleCopyCustom}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-100"
                >
                  {copiedCustom ? (
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

              {/* Default fallback */}
              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-400">
                Default fallback
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <code className="flex-1 truncate px-2 text-xs text-gray-400">
                  {defaultUrl}
                </code>
                <button
                  onClick={handleCopyDefault}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-500 shadow-sm transition-colors duration-200 hover:bg-gray-100"
                >
                  {copiedDefault ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                This link always works as a backup, even if your domain is removed later.
              </p>
            </>
          )}

          {/* ── Scenario B: Domain pending — default URL primary ── */}
          {hasPendingDomain && customUrl && (
            <>
              <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Default link
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <code className="flex-1 truncate px-2 text-sm text-gray-700">
                  {defaultUrl}
                </code>
                <a
                  href={defaultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={handleCopyDefault}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-100"
                >
                  {copiedDefault ? (
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

              <div className="mt-4 flex items-center gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Your domain
                </label>
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                  Pending DNS
                </span>
              </div>
              <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50/30 px-4 py-3">
                <code className="text-sm text-gray-400">{customUrl}</code>
              </div>
              <p className="mt-1 text-[11px] text-amber-600">
                This URL will work once DNS is configured.{" "}
                <Link
                  href="/control-panel/settings?tab=branding"
                  className="font-medium text-amber-700 hover:text-amber-800"
                >
                  Check status →
                </Link>
              </p>
            </>
          )}

          {/* ── Scenario A: No custom domain — single URL ── */}
          {!customDomainInfo && (
            <>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">
                {urlLabel}
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <code className="flex-1 truncate px-2 text-sm text-gray-700">
                  {defaultUrl}
                </code>
                <a
                  href={defaultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={handleCopyDefault}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-100"
                >
                  {copiedDefault ? (
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
            </>
          )}
        </div>
      )}

      {/* ── Domain nudge (only when no domain configured) ── */}
      {!customDomainInfo && (
        <div className="mt-5 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2.5 text-left">
            <Globe className="h-4 w-4 shrink-0 text-blue-400" />
            <p className="text-xs text-blue-700">
              Use your own domain for a fully branded client experience.
            </p>
          </div>
          <Link
            href="/control-panel/settings?tab=branding"
            className="shrink-0 whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Set up domain →
          </Link>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onCreateAnother}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Create Another
        </button>
        <Link
          href="/control-panel/client-portals"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
        >
          View All Portals
        </Link>
      </div>
    </div>
  );
}
