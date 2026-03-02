/**
 * Parse and serialize activity filter state to/from URL query params.
 * Enables bookmarkable filter views.
 */

export interface ActivityFilters {
  category: string | null;
  status: string | null;
  clientId: string | null;
  offeringId: string | null;
  from: string | null; // ISO datetime
  to: string | null; // ISO datetime
  search: string | null;
}

export const EMPTY_FILTERS: ActivityFilters = {
  category: null,
  status: null,
  clientId: null,
  offeringId: null,
  from: null,
  to: null,
  search: null,
};

/** Parse URL search params into ActivityFilters */
export function parseFiltersFromParams(params: URLSearchParams): ActivityFilters {
  return {
    category: params.get("category") || null,
    status: params.get("status") || null,
    clientId: params.get("client_id") || null,
    offeringId: params.get("offering_id") || null,
    from: params.get("from") || null,
    to: params.get("to") || null,
    search: params.get("search") || null,
  };
}

/** Serialize ActivityFilters into URLSearchParams (omits null/empty values) */
export function filtersToParams(filters: ActivityFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.clientId) params.set("client_id", filters.clientId);
  if (filters.offeringId) params.set("offering_id", filters.offeringId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.search) params.set("search", filters.search);
  return params;
}

/** Build API query string for /api/activity (includes limit and optional cursor) */
export function filtersToApiParams(
  filters: ActivityFilters,
  options?: { cursor?: string; limit?: number },
): URLSearchParams {
  const params = filtersToParams(filters);
  params.set("limit", String(options?.limit ?? 50));
  if (options?.cursor) params.set("cursor", options.cursor);
  return params;
}

/** Check if any filter is active */
export function hasActiveFilters(filters: ActivityFilters): boolean {
  return !!(
    filters.category ||
    filters.status ||
    filters.clientId ||
    filters.offeringId ||
    filters.from ||
    filters.to ||
    filters.search
  );
}

/** Date range presets — returns { from, to } ISO strings */
export function getDateRangePreset(
  preset: "1h" | "24h" | "7d" | "30d" | "90d",
): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  const offsets: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };

  const from = new Date(now.getTime() - offsets[preset]).toISOString();
  return { from, to };
}
