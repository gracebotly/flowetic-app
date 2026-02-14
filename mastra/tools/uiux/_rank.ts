
import { workspace } from '@/mastra/workspace';
import { ensureUIUXSearchInitialized } from './initUIUXSearch';

export type UIUXCSVRow = Record<string, string>;

/**
 * Rank rows by query using Workspace BM25 search.
 * Supports optional domain filtering to prevent cross-domain contamination.
 *
 * Without domain filtering, BM25 searches ALL 961+ indexed rows across 11 domains
 * (style, color, chart, landing, product, ux, typography, icons, web-interface,
 * react-performance, ui-reasoning) and may return rows from the wrong domain.
 *
 * Mastra workspace.search() has no native metadata filter, so we over-fetch
 * and post-filter by result.metadata.domain.
 */
export async function rankRowsByQuery(params: {
  rows: UIUXCSVRow[];
  query: string;
  limit: number;
  domain?: string;
}): Promise<UIUXCSVRow[]> {
  const { rows, query, limit, domain } = params;

  // Ensure search is initialized (lazy initialization)
  await ensureUIUXSearchInitialized();

  // If no query, return first N rows
  if (!query || query.trim().length === 0) {
    return rows.slice(0, limit);
  }

  try {
    // Over-fetch when domain filtering to account for cross-domain results being discarded
    const searchLimit = domain ? limit * 5 : limit;

    const results = await workspace.search(query, {
      topK: searchLimit,
      mode: 'bm25',
    });

    // Extract row data from metadata, filtering by domain if specified
    const matchedRows: UIUXCSVRow[] = [];
    const matchedIndices = new Set<number>();

    for (const result of results) {
      // Domain filter: skip results from wrong domains
      if (domain && result.metadata?.domain !== domain) {
        continue;
      }

      const row = result.metadata?.row as UIUXCSVRow | undefined;
      const index = result.metadata?.rowIndex as number | undefined;

      if (row && index !== undefined) {
        matchedRows.push(row);
        matchedIndices.add(index);
      }

      if (matchedRows.length >= limit) break;
    }

    // If we got fewer results than requested, pad with original rows
    if (matchedRows.length < limit && matchedRows.length < rows.length) {
      const additionalRows = rows
        .filter((_, i) => !matchedIndices.has(i))
        .slice(0, limit - matchedRows.length);
      matchedRows.push(...additionalRows);
    }

    return matchedRows;
  } catch (err) {
    console.error('[uiux] Search failed, falling back to original rows:', err);
    return rows.slice(0, limit);
  }
}
