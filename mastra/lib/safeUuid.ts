/**
 * Shared UUID sanitizer for the entire codebase.
 *
 * ROOT CAUSE: /api/indexed-entities/list constructs composite IDs as
 * `sourceId:externalId` (e.g., "26f0f623-...:7hrIRDrbWBA3wD3z").
 * This is NOT from Mastra's Memory.createThread() — the ":suffix" is
 * the n8n workflow external_id. This utility safely extracts the UUID
 * prefix from any such compound value.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_EXTRACT_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Returns true if value is a clean UUID string.
 */
export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Extract a valid UUID from a potentially corrupted/compound value.
 * Handles "uuid:externalId" composite format, null/undefined, and non-UUID strings.
 *
 * @param value - The raw value (possibly compound)
 * @param label - Optional label for warning logs (e.g., "sourceId")
 * @returns Clean UUID string or null
 */
export function safeUuid(
  value: string | null | undefined,
  label?: string,
): string | null {
  if (!value) return null;
  if (UUID_RE.test(value)) return value;

  const match = value.match(UUID_EXTRACT_RE);
  if (match) {
    const tag = label ? ` (${label})` : "";
    console.warn(
      `[safeUuid]${tag} Extracted UUID from compound value: "${value}" -> "${match[1]}"`,
    );
    return match[1]!;
  }

  const tag = label ? ` (${label})` : "";
  console.warn(`[safeUuid]${tag} Invalid UUID ignored: "${value}"`);
  return null;
}

/**
 * Same as safeUuid but returns the original value if it can't extract a UUID.
 * Useful when the value might legitimately not be a UUID (e.g., 'default-thread').
 */
export function safeUuidOrPassthrough(
  value: string | null | undefined,
  label?: string,
): string | null {
  if (!value) return null;
  const extracted = safeUuid(value, label);
  return extracted ?? value;
}
