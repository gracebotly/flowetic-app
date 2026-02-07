// mastra/normalizers/types.ts
// Shared types for platform-specific event normalizers

/**
 * Structured state object that downstream tools (analyzeSchema, generateMapping)
 * expect to find in the `state` column of stored events.
 */
export interface NormalizedState {
  workflow_id: string;
  workflow_name: string;
  execution_id: string;
  status: string;
  started_at: string;
  ended_at: string;
  duration_ms?: number;
  error_message?: string;
  platform: string;
  /** Platform-specific extras that don't fit the universal fields */
  [key: string]: unknown;
}

/**
 * The shape returned by each platform normalizer's normalize() function.
 * normalizeEvents merges this with tenant_id, source_id, platform_event_id, timestamp.
 */
export interface NormalizedEventFragment {
  type: string;
  name: string;
  state: NormalizedState;
  labels: Record<string, unknown>;
}

/**
 * Contract every platform normalizer must implement.
 */
export interface PlatformNormalizer {
  /**
   * Transform a raw event (as returned by fetchPlatformEvents) into
   * a structured fragment with proper state and labels.
   */
  normalize(raw: Record<string, unknown>): NormalizedEventFragment;

  /**
   * Returns the list of field names that analyzeSchema should expect
   * in the `state` column for this platform. Used to boost confidence
   * scoring and prevent "missing fields" suspensions.
   */
  getExpectedFields(): string[];
}
