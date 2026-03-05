"use client";

import React from "react";

// Brand colors from actual platform brand kits (matches existing fallbackBg in platform-icons.tsx)
const PLATFORM_STYLES: Record<
  string,
  { bg: string; text: string; letter: string; label: string }
> = {
  vapi: {
    bg: "#07B0CE",
    text: "#FFFFFF",
    letter: "V",
    label: "Vapi",
  },
  retell: {
    bg: "#111827",
    text: "#FFFFFF",
    letter: "R",
    label: "Retell",
  },
  n8n: {
    bg: "#EA4B71",
    text: "#FFFFFF",
    letter: "n8n",
    label: "n8n",
  },
  make: {
    bg: "#6D00CC",
    text: "#FFFFFF",
    letter: "M",
    label: "Make",
  },
};

const FALLBACK = {
  bg: "#6B7280",
  text: "#FFFFFF",
  letter: "?",
  label: "Unknown",
};

type PlatformBadgeProps = {
  platform: string;
  /** px size of the badge square. Default 32 */
  size?: number;
  className?: string;
};

export function PlatformBadge({
  platform,
  size = 32,
  className = "",
}: PlatformBadgeProps) {
  const style = PLATFORM_STYLES[platform.toLowerCase()] ?? FALLBACK;

  const fontSize = style.letter.length > 1 ? size * 0.3 : size * 0.42;

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center rounded-lg select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: style.bg,
        color: style.text,
        fontSize,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      aria-label={style.label}
    >
      {style.letter}
    </div>
  );
}

/** Return the human-readable platform label */
export function getPlatformLabel(platform: string): string {
  return (
    PLATFORM_STYLES[platform.toLowerCase()]?.label ??
    platform.charAt(0).toUpperCase() + platform.slice(1)
  );
}

/** Soft-colored pill background classes per platform */
export const PLATFORM_PILL_CLASSES: Record<string, string> = {
  vapi: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/60",
  retell: "bg-gray-100 text-gray-700 ring-1 ring-gray-200/60",
  n8n: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60",
  make: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
};

export const PLATFORM_PILL_FALLBACK =
  "bg-gray-50 text-gray-600 ring-1 ring-gray-200/60";
