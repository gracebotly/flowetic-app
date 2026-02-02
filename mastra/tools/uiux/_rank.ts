
import { workspace } from '@/mastra/workspace';
import { ensureUIUXSearchInitialized } from './initUIUXSearch';

export type UIUXCSVRow = Record<string, string>;

/**
 * Rank rows by query using Workspace BM25 search.
 * Replaces the previous token-based ranking with more accurate semantic search.
 */
export async function rankRowsByQuery(params: {
  rows: UIUXCSVRow[];
  query: string;
  limit: number;
}): Promise<UIUXCSVRow[]> {
  const { rows, query, limit } = params;

  // Ensure search is initialized (lazy initialization)
  await ensureUIUXSearchInitialized();

  // If no query, return first N rows
  if (!query || query.trim().length === 0) {
    return rows.slice(0, limit);
  }

  try {
    // Search using Workspace BM25
    const results = await workspace.search(query, {
      topK: limit,
      mode: 'bm25',
    });

    // Extract row data from metadata
    const matchedRows: UIUXCSVRow[] = [];
    const matchedIndices = new Set<number>();
    
    for (const result of results) {
      const row = result.metadata?.row as UIUXCSVRow | undefined;
      const index = result.metadata?.rowIndex as number | undefined;
      
      if (row && index !== undefined) {
        matchedRows.push(row);
        matchedIndices.add(index);
      }
    }

    // If we got fewer results than requested, pad with original rows
    if (matchedRows.length < limit && matchedRows.length < rows.length) {
      const additionalRows = rows.filter((_, i) => !matchedIndices.has(i)).slice(0, limit - matchedRows.length);
      matchedRows.push(...additionalRows);
    }

    return matchedRows;
  } catch (err) {
    console.error('[uiux] Search failed, falling back to original rows:', err);
    // Fallback: return first N rows if search fails
    return rows.slice(0, limit);
  }
}
