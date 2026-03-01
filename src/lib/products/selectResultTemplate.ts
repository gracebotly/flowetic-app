/**
 * Deterministic result template selection based on output shape.
 * No AI — pure pattern matching on the outputs object.
 *
 * Templates:
 * - 'success-message' — single value or empty outputs
 * - 'score-card'      — outputs contain score/rating/confidence numeric fields
 * - 'data-card'       — key-value pairs (default for structured data)
 * - 'table-result'    — outputs contain an array of objects
 * - 'download-result' — outputs contain a URL/link/download field
 */

export type ResultTemplate =
  | 'success-message'
  | 'score-card'
  | 'data-card'
  | 'table-result'
  | 'download-result';

export function selectResultTemplate(
  outputs: Record<string, unknown>,
): ResultTemplate {
  const entries = Object.entries(outputs);

  // No outputs or single simple string → success message
  if (entries.length === 0) return 'success-message';
  if (
    entries.length === 1 &&
    typeof entries[0][1] === 'string' &&
    !entries[0][1].startsWith('http')
  ) {
    return 'success-message';
  }

  // Contains an array of objects → table result
  const hasTable = entries.some(
    ([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object',
  );
  if (hasTable) return 'table-result';

  // Contains a URL/link/download field → download result
  const hasDownload = entries.some(
    ([k, v]) =>
      typeof v === 'string' &&
      (v.startsWith('http://') || v.startsWith('https://')) &&
      (k.toLowerCase().includes('url') ||
        k.toLowerCase().includes('link') ||
        k.toLowerCase().includes('download') ||
        k.toLowerCase().includes('file')),
  );
  if (hasDownload) return 'download-result';

  // Contains score/rating/confidence numeric field → score card
  const hasScore = entries.some(
    ([k, v]) =>
      typeof v === 'number' &&
      (k.toLowerCase().includes('score') ||
        k.toLowerCase().includes('rating') ||
        k.toLowerCase().includes('confidence') ||
        k.toLowerCase().includes('grade')),
  );
  if (hasScore) return 'score-card';

  // Default: structured key-value display
  return 'data-card';
}

/**
 * Format a single output field for display.
 * Returns a human-readable label, display string, and type hint.
 */
export function formatOutputValue(
  key: string,
  value: unknown,
): { label: string; display: string; type: 'text' | 'number' | 'url' | 'boolean' | 'json' } {
  // Convert snake_case / camelCase to Title Case
  const label = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (value === null || value === undefined) {
    return { label, display: '—', type: 'text' };
  }

  if (typeof value === 'boolean') {
    return { label, display: value ? 'Yes' : 'No', type: 'boolean' };
  }

  if (typeof value === 'number') {
    return { label, display: value.toLocaleString(), type: 'number' };
  }

  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return { label, display: value, type: 'url' };
    }
    return { label, display: value, type: 'text' };
  }

  if (Array.isArray(value)) {
    return {
      label,
      display: value
        .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
        .join(', '),
      type: 'json',
    };
  }

  if (typeof value === 'object') {
    return { label, display: JSON.stringify(value, null, 2), type: 'json' };
  }

  return { label, display: String(value), type: 'text' };
}
