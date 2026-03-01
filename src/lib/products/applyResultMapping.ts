// ============================================================================
// Apply result field mapping from execution_config.result_mapping
// Maps raw webhook output keys → friendly display keys
// ============================================================================

export interface ResultMapping {
  [rawKey: string]: string; // rawKey → display label
}

/**
 * Apply result_mapping to raw outputs.
 * If no mapping exists, returns outputs as-is.
 */
export function applyResultMapping(
  rawOutputs: Record<string, unknown> | null | undefined,
  resultMapping: ResultMapping | null | undefined,
): Record<string, unknown> {
  if (!rawOutputs || typeof rawOutputs !== 'object') return {};

  // No mapping — pass through
  if (!resultMapping || Object.keys(resultMapping).length === 0) {
    return rawOutputs;
  }

  const mapped: Record<string, unknown> = {};

  for (const [rawKey, displayLabel] of Object.entries(resultMapping)) {
    if (rawKey in rawOutputs) {
      mapped[displayLabel] = rawOutputs[rawKey];
    }
  }

  // If mapping was too narrow, include unmapped fields as fallback
  if (Object.keys(mapped).length === 0) {
    return rawOutputs;
  }

  return mapped;
}
