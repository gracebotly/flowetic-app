"use client";

import React from "react";

/*
 * Premium skeleton loaders for Connections page.
 *
 * Design:
 * - Diagonal shimmer sweep (not a boring opacity pulse)
 * - Skeleton shapes match EXACT dimensions of real content
 * - Staggered fade-up per row (feels alive, not static)
 * - Inventory import gets an animated multi-phase indicator
 */

const SHIMMER_CSS = `
@keyframes gf-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes gf-fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes gf-pulse-ring {
  0% { transform: scale(0.9); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 0.15; }
  100% { transform: scale(0.9); opacity: 0.5; }
}
@keyframes gf-bar-slide {
  0% { left: -30%; }
  100% { left: 100%; }
}
@keyframes gf-spin {
  to { transform: rotate(360deg); }
}
`;

function InjectStyles() {
  return <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />;
}

function ShimmerBar({
  width,
  height = 14,
  rounded = 6,
  className = "",
}: {
  width: string | number;
  height?: number;
  rounded?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: `${height}px`,
        borderRadius: `${rounded}px`,
        background:
          "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
        backgroundSize: "800px 100%",
        animation: "gf-shimmer 1.8s ease-in-out infinite",
      }}
    />
  );
}

/* ── Credential row skeleton ──────────────────────────────────── */
function CredentialRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-lg border border-gray-100 bg-white p-4"
      style={{ animation: `gf-fade-up 0.4s ease-out ${delay}ms both` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background:
                "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
              backgroundSize: "800px 100%",
              animation: "gf-shimmer 1.8s ease-in-out infinite",
            }}
          />
          <div className="space-y-2.5">
            <ShimmerBar width={120} height={16} />
            <div className="flex items-center gap-2">
              <ShimmerBar width={50} height={12} />
              <ShimmerBar width={100} height={12} />
              <ShimmerBar width={80} height={12} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShimmerBar width={72} height={24} rounded={12} />
          <ShimmerBar width={32} height={32} rounded={8} />
        </div>
      </div>
    </div>
  );
}

/* ── Entity row skeleton ──────────────────────────────────────── */
function EntityRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl border border-gray-100 bg-white px-5 py-4"
      style={{ animation: `gf-fade-up 0.4s ease-out ${delay}ms both` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background:
                "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
              backgroundSize: "800px 100%",
              animation: "gf-shimmer 1.8s ease-in-out infinite",
            }}
          />
          <div className="space-y-2.5">
            <ShimmerBar width={180} height={16} />
            <div className="flex items-center gap-2">
              <ShimmerBar width={60} height={12} />
              <ShimmerBar width={40} height={12} />
              <ShimmerBar width={110} height={12} />
            </div>
          </div>
        </div>
        <ShimmerBar width={32} height={32} rounded={8} />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   EXPORTS
   ═════════════════════════════════════════════════════════════════ */

export function CredentialsLoadingSkeleton() {
  return (
    <>
      <InjectStyles />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <CredentialRowSkeleton key={i} delay={i * 80} />
        ))}
      </div>
    </>
  );
}

export function EntitiesLoadingSkeleton() {
  return (
    <>
      <InjectStyles />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <EntityRowSkeleton key={i} delay={i * 80} />
        ))}
      </div>
    </>
  );
}

/**
 * Premium inventory import loader for the Connect Platform modal.
 * Shows animated spinner, contextual status text, indeterminate
 * progress bar, and ghost-preview of what rows will look like.
 */
export function InventoryImportLoader({ platform }: { platform: string }) {
  const noun =
    platform === "vapi"
      ? "assistants"
      : platform === "retell"
        ? "agents"
        : platform === "make"
          ? "scenarios"
          : "workflows";

  const label =
    platform === "n8n"
      ? "n8n"
      : platform === "make"
        ? "Make"
        : platform === "vapi"
          ? "Vapi"
          : platform === "retell"
            ? "Retell"
            : platform;

  return (
    <>
      <InjectStyles />
      <div className="flex flex-col items-center px-4 py-10">
        {/* Animated double-ring spinner */}
        <div className="relative mb-6" style={{ width: 56, height: 56 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: "#3b82f6",
              animation: "gf-spin 1s linear infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "2px solid #3b82f6",
              animation: "gf-pulse-ring 2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Contextual status */}
        <p className="text-sm font-semibold text-gray-900">Importing from {label}</p>
        <p className="mt-1.5 text-sm text-gray-500">
          Fetching your {noun} — usually takes a few seconds
        </p>

        {/* Indeterminate progress bar */}
        <div
          className="mt-6 w-full max-w-xs overflow-hidden rounded-full"
          style={{ height: 4, backgroundColor: "#e2e8f0", position: "relative" }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              width: "30%",
              height: "100%",
              borderRadius: 9999,
              background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
              animation: "gf-bar-slide 1.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Ghost preview of incoming rows */}
        <div className="mt-8 w-full max-w-sm space-y-2.5 opacity-40">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5"
              style={{ animation: `gf-fade-up 0.5s ease-out ${200 + i * 120}ms both` }}
            >
              <ShimmerBar width={20} height={20} rounded={4} />
              <ShimmerBar width={`${65 - i * 10}%`} height={12} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Premium saving/connecting overlay for the credentials step.
 * Replaces the plain text + basic spinner with a branded card.
 */
export function CredentialSavingOverlay({
  isEditing,
  platform,
}: {
  isEditing: boolean;
  platform: string;
}) {
  const label =
    platform === "n8n"
      ? "n8n"
      : platform === "make"
        ? "Make"
        : platform === "vapi"
          ? "Vapi"
          : platform === "retell"
            ? "Retell"
            : platform;

  return (
    <>
      <InjectStyles />
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <div
          className="flex-shrink-0 rounded-full"
          style={{
            width: 20,
            height: 20,
            border: "2.5px solid #bfdbfe",
            borderTopColor: "#3b82f6",
            animation: "gf-spin 0.8s linear infinite",
          }}
        />
        <div>
          <p className="text-sm font-medium text-blue-900">
            {isEditing ? "Saving changes…" : `Connecting to ${label}…`}
          </p>
          <p className="text-xs text-blue-700/70">
            {isEditing
              ? "Updating your credentials"
              : "Validating credentials and fetching inventory"}
          </p>
        </div>
      </div>
    </>
  );
}
