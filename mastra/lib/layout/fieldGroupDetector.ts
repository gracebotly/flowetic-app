// mastra/lib/layout/fieldGroupDetector.ts
//
// Detects field groups from dot-notation field names.
// Computes per-group null rates to distinguish input-only (body.*)
// from output-only (research.*) fields by correlating with event status.
//
// Pure function — no Supabase, no Mastra, no side effects.

export interface FieldGroup {
  /** Dot-notation prefix, e.g. 'body', 'research', 'metadata' */
  prefix: string;
  /** Full field names in this group, e.g. ['body.topic', 'body.industry'] */
  fields: string[];
  /** Average null rate across all fields in this group (0-1) */
  avgNullRate: number;
  /** If group correlates with a specific status value, e.g. 'error' for body.*, 'success' for research.* */
  correlatedStatus?: string;
}

interface FieldInput {
  name: string;
  nullCount: number;
  totalRows: number;
}

/**
 * Detect field groups from dot-notation field names.
 *
 * Groups fields by their first dot-segment prefix:
 *   - 'body.topic', 'body.industry' → group 'body'
 *   - 'research.summary', 'research.key_findings' → group 'research'
 *   - 'status', 'created_at' → no group (top-level, ignored)
 *
 * Optionally correlates groups with status field values when events are provided.
 * If body.* fields are consistently null when status=success but populated when
 * status=error, the group gets correlatedStatus='error'.
 *
 * @param fields - Array of field analysis results with null counts
 * @param events - Optional raw events for status correlation
 * @returns Array of FieldGroup objects, sorted by field count descending
 */
export function detectFieldGroups(
  fields: FieldInput[],
  events?: Array<Record<string, unknown>>,
): FieldGroup[] {
  // Step 1: Group fields by dot-notation prefix
  const groupMap = new Map<string, { fields: string[]; nullCounts: number[]; totalRows: number[] }>();

  for (const field of fields) {
    const dotIndex = field.name.indexOf('.');
    if (dotIndex <= 0) continue; // Skip top-level fields (no dot or starts with dot)

    const prefix = field.name.substring(0, dotIndex);
    if (!groupMap.has(prefix)) {
      groupMap.set(prefix, { fields: [], nullCounts: [], totalRows: [] });
    }
    const group = groupMap.get(prefix)!;
    group.fields.push(field.name);
    group.nullCounts.push(field.nullCount);
    group.totalRows.push(field.totalRows);
  }

  // Step 2: Compute per-group metrics
  const result: FieldGroup[] = [];

  for (const [prefix, data] of groupMap) {
    if (data.fields.length < 2) continue; // Single-field "groups" aren't useful

    const totalNulls = data.nullCounts.reduce((a, b) => a + b, 0);
    const totalRows = data.totalRows.reduce((a, b) => a + b, 0);
    const avgNullRate = totalRows > 0 ? totalNulls / totalRows : 0;

    const group: FieldGroup = {
      prefix,
      fields: data.fields,
      avgNullRate: Math.round(avgNullRate * 100) / 100, // Round to 2 decimal places
    };

    // Step 3: Correlate with status if events provided
    if (events && events.length > 0) {
      const statusCorrelation = correlateGroupWithStatus(data.fields, events);
      if (statusCorrelation) {
        group.correlatedStatus = statusCorrelation;
      }
    }

    result.push(group);
  }

  // Sort by field count descending (largest groups first)
  return result.sort((a, b) => b.fields.length - a.fields.length);
}

/**
 * Check if a field group's non-null presence correlates with a specific status value.
 * Returns the status value if >70% of non-null instances for this group occur with that status.
 */
function correlateGroupWithStatus(
  fieldNames: string[],
  events: Array<Record<string, unknown>>,
): string | undefined {
  // Find the status field (common names)
  const statusKey = findStatusKey(events[0] ?? {});
  if (!statusKey) return undefined;

  // Count how many times this group has non-null values per status
  const statusCounts = new Map<string, number>();
  let totalNonNull = 0;

  for (const event of events) {
    const statusValue = String(event[statusKey] ?? '').toLowerCase();
    if (!statusValue) continue;

    // Check if any field in this group has a non-null value in this event
    const hasValue = fieldNames.some((fieldName) => {
      const value = getNestedValue(event, fieldName);
      return value !== null && value !== undefined && value !== '';
    });

    if (hasValue) {
      totalNonNull++;
      statusCounts.set(statusValue, (statusCounts.get(statusValue) ?? 0) + 1);
    }
  }

  if (totalNonNull < 2) return undefined; // Not enough data

  // Find dominant status (>70% correlation)
  for (const [status, count] of statusCounts) {
    if (count / totalNonNull > 0.7) {
      return status;
    }
  }

  return undefined;
}

/** Find the status-like key in a flat or one-level-nested event */
function findStatusKey(event: Record<string, unknown>): string | undefined {
  const candidates = ['status', 'state', 'result', 'outcome'];
  for (const key of candidates) {
    if (key in event) return key;
  }
  return undefined;
}

/** Get a value from a nested path like 'body.topic' from a flat or nested event */
function getNestedValue(event: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = event;

  // First try: direct key lookup (analyzeSchema already flattened to 'body.topic')
  if (path in event) return event[path];

  // Second try: nested traversal
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
