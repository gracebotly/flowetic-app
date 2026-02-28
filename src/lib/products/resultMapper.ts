// ============================================================================
// Level 4: Result Mapping Engine
// Maps raw workflow output → structured results for ResultsDisplay
// ============================================================================

import type { ResultMapping } from "./types";

/**
 * Resolve a simple dot-notation path on an object.
 * Supports: "$.data.score", "data.items[0].name", "headline"
 * Gracefully returns undefined for missing paths.
 */
function resolvePath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;

  // Strip leading "$." if present
  const clean = path.startsWith("$.") ? path.slice(2) : path;

  const segments = clean.split(/\.|\[(\d+)\]/).filter(Boolean);
  let current: unknown = obj;

  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    // Numeric index for arrays
    const idx = Number(seg);
    if (!Number.isNaN(idx) && Array.isArray(current)) {
      current = current[idx];
    } else {
      current = (current as Record<string, unknown>)[seg];
    }
  }

  return current;
}

/**
 * Apply a result mapping to raw workflow output.
 *
 * @param rawOutput - The raw JSON response from Make/n8n webhook
 * @param mapping   - Object mapping display keys to JSONPath-like strings
 * @returns Mapped results with resolved values, or raw output as fallback
 *
 * @example
 * ```ts
 * const mapping = {
 *   "title": "$.data.headline",
 *   "score": "$.data.qualification_score",
 *   "analysis": "$.data.detailed_analysis",
 * };
 * const result = applyResultMapping(webhookResponse, mapping);
 * // { title: "...", score: 87, analysis: "..." }
 * ```
 */
export function applyResultMapping(
  rawOutput: unknown,
  mapping: ResultMapping | null | undefined,
): Record<string, unknown> {
  // No mapping → return raw output as-is
  if (!mapping || Object.keys(mapping).length === 0) {
    if (rawOutput && typeof rawOutput === "object" && !Array.isArray(rawOutput)) {
      return rawOutput as Record<string, unknown>;
    }
    return { _raw: rawOutput };
  }

  const result: Record<string, unknown> = {};
  let mappedCount = 0;

  for (const [displayKey, path] of Object.entries(mapping)) {
    if (typeof path !== "string") continue;
    const value = resolvePath(rawOutput, path);
    if (value !== undefined) {
      result[displayKey] = value;
      mappedCount++;
    }
  }

  // If zero fields resolved, fallback to raw output
  if (mappedCount === 0) {
    if (rawOutput && typeof rawOutput === "object" && !Array.isArray(rawOutput)) {
      return rawOutput as Record<string, unknown>;
    }
    return { _raw: rawOutput };
  }

  return result;
}
