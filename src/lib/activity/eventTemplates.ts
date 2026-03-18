/**
 * Color/icon mapping and human-readable message templates for activity events.
 * Used by the API to enrich events and by the UI to render them.
 */

export type EventColor = "emerald" | "amber" | "red" | "blue" | "gray";

export interface EventTemplate {
  color: EventColor;
  icon: string; // lucide-react icon name
}

/** Category + status → color mapping */
export const CATEGORY_META: Record<string, EventTemplate> = {
  access: { color: "blue", icon: "Eye" },
  execution: { color: "emerald", icon: "Zap" },
  portal: { color: "amber", icon: "Package" },
  client: { color: "amber", icon: "Users" },
  connection: { color: "emerald", icon: "Plug" },
  team: { color: "blue", icon: "UserPlus" },
  settings: { color: "gray", icon: "Settings" },
  billing: { color: "emerald", icon: "CreditCard" },
};

/** Override color when status is error/warning */
export function resolveColor(category: string, status: string): EventColor {
  if (status === "error") return "red";
  if (status === "warning") return "amber";
  return CATEGORY_META[category]?.color ?? "gray";
}

/** Get icon for a category */
export function resolveIcon(category: string): string {
  return CATEGORY_META[category]?.icon ?? "Activity";
}

/**
 * Message templates keyed by `category.action`.
 * Each template receives the activity_events row and returns a human string.
 * If no template matches, the raw `message` column is used as fallback.
 */
export const MESSAGE_TEMPLATES: Record<
  string,
  (e: { entity_name?: string | null; details?: Record<string, unknown> | null }) => string
> = {
  "portal.created": (e) => `Created portal "${e.entity_name ?? "Untitled"}"`,
  "portal.updated": (e) => `Updated portal "${e.entity_name ?? "Untitled"}"`,
  "portal.archived": (e) => `Archived portal "${e.entity_name ?? "Untitled"}"`,
  "portal.published": (e) => `Published portal "${e.entity_name ?? "Untitled"}"`,
  "portal.paused": (e) => `Paused portal "${e.entity_name ?? "Untitled"}"`,
  "client.created": (e) => `Added client "${e.entity_name ?? "Unknown"}"`,
  "client.updated": (e) => `Updated client "${e.entity_name ?? "Unknown"}"`,
  "client.archived": (e) => `Archived client "${e.entity_name ?? "Unknown"}"`,
  "execution.completed":
    (e) =>
      `"${e.entity_name ?? "Workflow"}" executed successfully${e.details?.duration_ms ? ` (${e.details.duration_ms}ms)` : ""}`,
  "execution.failed":
    (e) =>
      `"${e.entity_name ?? "Workflow"}" execution failed${e.details?.error_message ? `: ${e.details.error_message}` : ""}`,
  "access.token_generated": (e) =>
    `Generated magic link for "${e.entity_name ?? "portal"}"`,
  "access.token_revoked": (e) =>
    `Revoked magic link for "${e.entity_name ?? "portal"}"`,
  "access.viewed":
    (e) =>
      `${(e.details?.viewer as string) ?? "Someone"} viewed "${e.entity_name ?? "portal"}"`,
  "connection.connected":
    (e) =>
      `Connected ${(e.details?.platform_type as string) ?? ""} source "${e.entity_name ?? ""}"`,
  "connection.error":
    (e) =>
      `Connection error on "${e.entity_name ?? ""}"${e.details?.error ? `: ${e.details.error}` : ""}`,
  "team.invited":
    (e) =>
      `Invited ${(e.details?.email as string) ?? "user"} as ${(e.details?.role as string) ?? "member"}`,
  "team.joined": (e) => `${e.entity_name ?? "User"} accepted invite and joined`,
  "settings.branding_updated": () => `Updated agency branding`,
  "billing.payment_received":
    (e) =>
      `Received $${(((e.details?.amount_cents as number) ?? 0) / 100).toFixed(2)} from ${e.entity_name ?? "customer"}`,
};
