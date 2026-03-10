"use client";

import Link from "next/link";

interface EntityBadgeProps {
  type: "client" | "portal" | "connection" | string;
  id: string | null;
  name: string | null;
}

const BADGE_STYLES: Record<string, string> = {
  client: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  offering: "bg-purple-50 text-purple-700 hover:bg-purple-100",
  connection: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
};

const BADGE_PREFIX: Record<string, string> = {
  client: "Client",
  offering: "Client Portal",
  connection: "Connection",
};

function getHref(type: string, id: string): string | null {
  switch (type) {
    case "client":
      return `/control-panel/clients/${id}`;
    case "portal":
      return `/control-panel/client-portals/${id}`;
    case "connection":
      return `/control-panel/connections`;
    default:
      return null;
  }
}

export function EntityBadge({ type, id, name }: EntityBadgeProps) {
  const displayName = name || BADGE_PREFIX[type] || type;
  const style = BADGE_STYLES[type] ?? "bg-gray-50 text-gray-600 hover:bg-gray-100";
  const href = id ? getHref(type, id) : null;

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition ${style} ${href ? "cursor-pointer" : ""}`}
    >
      {BADGE_PREFIX[type] ? (
        <span className="opacity-60">{BADGE_PREFIX[type]}:</span>
      ) : null}
      <span className="max-w-[120px] truncate">{displayName}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="no-underline">
        {badge}
      </Link>
    );
  }

  return badge;
}
