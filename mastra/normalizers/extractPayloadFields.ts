// mastra/normalizers/extractPayloadFields.ts
// ============================================================================
// Extract meaningful business data from n8n execution runData.
//
// n8n's runData is a map of node names → execution arrays. Each node's output
// lives at: runData["NodeName"][0].data.main[0][0].json
//
// Strategy:
//   1. Sort nodes by executionIndex (execution order)
//   2. Walk backwards from last node, skip sparse/error nodes
//   3. Merge fields from the richest nodes (prefer later nodes' values)
//   4. Cap at 25 fields, skip binary/metadata/large arrays
//   5. Normalize keys to snake_case
//
// This runs during import and live-fetch. Must be fast and defensive.
// ============================================================================

export interface ExtractionResult {
  /** Extracted key-value pairs to merge into event state JSONB */
  fields: Record<string, unknown>;
  /** Which node the primary data came from */
  nodeSource: string;
  /** How many fields were extracted */
  fieldCount: number;
}

const MAX_FIELDS = 25;
const MIN_RICH_FIELDS = 3;
const MAX_RICH_NODES = 3;

/**
 * Extract the JSON output from a single node's runData entry.
 * Path: runData[nodeName][lastRun].data.main[0][0].json
 *
 * Falls back through multiple output items if first is empty.
 */
function getNodeJson(
  nodeRuns: any[] | undefined,
): Record<string, unknown> | null {
  if (!Array.isArray(nodeRuns) || nodeRuns.length === 0) return null;

  // Use the last run (most recent execution of this node)
  const lastRun = nodeRuns[nodeRuns.length - 1];
  const mainOutput = lastRun?.data?.main?.[0];
  if (!Array.isArray(mainOutput) || mainOutput.length === 0) return null;

  // Try the first item
  const json = mainOutput[0]?.json;
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return json as Record<string, unknown>;
  }

  return null;
}

/**
 * Check if a node's output looks like an error response.
 * Error nodes typically have only an `error` key or very few keys.
 */
function isErrorOutput(json: Record<string, unknown>): boolean {
  const keys = Object.keys(json);
  if (keys.length === 0) return true;
  if (keys.length <= 2 && json.error !== undefined) return true;
  if (keys.length === 1 && (json.errorMessage !== undefined || json.message !== undefined)) return true;
  return false;
}

/**
 * Normalize a camelCase or mixed-case key to snake_case.
 * "leadScore" → "lead_score", "firstName" → "first_name"
 */
function toSnakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Check if a value is safe to store in JSONB state.
 * Rejects: binary data, huge arrays, deeply nested objects, functions.
 */
function isSafeValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'function' || typeof value === 'symbol') return false;
  if (typeof value === 'string' && value.length > 1000) return false;
  if (Array.isArray(value) && value.length > 10) return false;
  // Allow simple objects (1 level deep) but skip deeply nested
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const nested = value as Record<string, unknown>;
    const nestedKeys = Object.keys(nested);
    if (nestedKeys.length > 10) return false;
    // Check if any nested value is itself an object (too deep)
    for (const v of Object.values(nested)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) return false;
    }
    return true;
  }
  return true;
}

// Keys that are n8n internal metadata, not business data
const SKIP_KEYS = new Set([
  'pairedItem', 'pairedItems', '_meta', '__meta', 'binary',
  'executionData', 'headers', 'params', 'query', 'webhookUrl',
  'responseHeaders', 'statusCode', 'statusMessage',
]);

/**
 * Extract meaningful business data from n8n execution runData.
 *
 * @param runData - The `exec.data.resultData.runData` object from n8n API
 * @param lastNodeExecuted - The `exec.data.resultData.lastNodeExecuted` string
 * @returns ExtractionResult with fields to merge into event state
 */
export function extractPayloadFields(
  runData: Record<string, any[]> | undefined,
  lastNodeExecuted: string | undefined,
): ExtractionResult {
  const empty: ExtractionResult = { fields: {}, nodeSource: '', fieldCount: 0 };

  if (!runData || typeof runData !== 'object') return empty;

  const nodeNames = Object.keys(runData);
  if (nodeNames.length === 0) return empty;

  // Step 1: Sort nodes by executionIndex (execution order within the workflow)
  const orderedNodes = nodeNames
    .map(name => ({
      name,
      executionIndex: runData[name]?.[0]?.executionIndex ?? 999,
    }))
    .sort((a, b) => a.executionIndex - b.executionIndex);

  // Step 2: Build priority list — start from lastNodeExecuted, walk backwards
  const priorityList: string[] = [];

  // Add lastNodeExecuted first if it exists
  if (lastNodeExecuted && nodeNames.includes(lastNodeExecuted)) {
    priorityList.push(lastNodeExecuted);
  }

  // Add remaining nodes in reverse execution order (newest first)
  for (let i = orderedNodes.length - 1; i >= 0; i--) {
    const name = orderedNodes[i].name;
    if (!priorityList.includes(name)) {
      priorityList.push(name);
    }
  }

  // Step 3: Walk through nodes, collect fields from richest ones
  const extracted: Record<string, unknown> = {};
  let primarySource = '';
  let richNodesFound = 0;

  for (const nodeName of priorityList) {
    if (richNodesFound >= MAX_RICH_NODES) break;
    if (Object.keys(extracted).length >= MAX_FIELDS) break;

    const json = getNodeJson(runData[nodeName]);
    if (!json) continue;
    if (isErrorOutput(json)) continue;

    // Count meaningful (non-null, non-skip) fields in this node
    let nodeFieldCount = 0;
    const nodeFields: Array<[string, unknown]> = [];

    for (const [key, value] of Object.entries(json)) {
      if (SKIP_KEYS.has(key)) continue;
      if (key.startsWith('_')) continue;
      if (value === null || value === undefined) continue;
      if (!isSafeValue(value)) continue;

      nodeFields.push([key, value]);
      nodeFieldCount++;
    }

    // Skip sparse nodes (< 3 meaningful fields) unless it's the only option
    if (nodeFieldCount < MIN_RICH_FIELDS && richNodesFound > 0) continue;

    // Merge fields — later values do NOT overwrite earlier ones
    // (earlier nodes in priority list are considered more authoritative)
    for (const [key, value] of nodeFields) {
      if (Object.keys(extracted).length >= MAX_FIELDS) break;

      const normalizedKey = toSnakeCase(key);

      // Don't overwrite existing fields or base state fields
      if (extracted[normalizedKey] !== undefined) continue;
      if (BASE_STATE_KEYS.has(normalizedKey)) continue;

      extracted[normalizedKey] = value;
    }

    if (!primarySource && nodeFieldCount >= MIN_RICH_FIELDS) {
      primarySource = nodeName;
    }
    if (nodeFieldCount >= MIN_RICH_FIELDS) {
      richNodesFound++;
    }
  }

  return {
    fields: extracted,
    nodeSource: primarySource || priorityList[0] || '',
    fieldCount: Object.keys(extracted).length,
  };
}

// Keys that already exist in the base state object — never overwrite these
const BASE_STATE_KEYS = new Set([
  'workflow_id', 'workflow_name', 'execution_id', 'status',
  'started_at', 'ended_at', 'duration_ms', 'error_message', 'platform',
]);
