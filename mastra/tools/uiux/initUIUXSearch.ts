
import { workspace } from '@/mastra/workspace';

const CSV_DOMAINS = [
  'style',
  'color',
  'chart',
  'landing',
  'product',
  'ux',
  'typography',
  'icons',
  'web-interface',
  'react-performance',
  'ui-reasoning',
] as const;

/**
 * Index all CSV rows into workspace search.
 * Each row becomes a separate document with metadata for retrieval.
 * 
 * This should be called during application initialization.
 */
export async function initUIUXSearch(): Promise<void> {
  console.log('[uiux] Initializing UI/UX search indexing...');
  
  for (const domain of CSV_DOMAINS) {
    try {
      const rows = await loadCSV(domain);
      if (rows.length === 0) {
        console.log(`[uiux] No rows found for domain: ${domain}`);
        continue;
      }

      // Index each row as a separate document
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const text = Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        const docId = `uiux-${domain}-row-${i}`;
        
        await workspace.index(docId, text, {
          metadata: {
            domain,
            rowIndex: i,
            row, // Store original row data in metadata
          },
        });
      }

      console.log(`[uiux] Indexed ${rows.length} rows for domain: ${domain}`);
    } catch (err) {
      console.error(`[uiux] Failed to index domain: ${domain}`, err);
    }
  }

  console.log('[uiux] UI/UX search indexing complete');
}

/**
 * Load UI/UX rows from Supabase instead of parsing CSV files.
 * Delegates to the canonical loadUIUXCSV which handles:
 * - uiux_data table queries
 * - In-memory caching
 * - Double-stringify JSONB handling
 * - Error handling
 */
async function loadCSV(domain: string): Promise<Record<string, string>[]> {
  const { loadUIUXCSV } = await import('./loadUIUXCSV');
  return loadUIUXCSV(domain);
}

/**
 * Promise-lock singleton: ensures initUIUXSearch() runs exactly once,
 * even when multiple tools call ensureUIUXSearchInitialized() concurrently
 * on a cold serverless start.
 *
 * Evidence: Vercel logs (2026-02-14 23:27:12-13) show two concurrent callers
 * both entering initUIUXSearch(), doubling all 9 domain queries (18 Supabase
 * requests, ~672 KB duplicate egress, ~1s wasted).
 *
 * Pattern: first caller creates the Promise; all subsequent callers await it.
 */
let initPromise: Promise<void> | null = null;
export async function ensureUIUXSearchInitialized(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Probe: warm container may already have the index populated
    try {
      const testResults = await workspace.search('test', { topK: 1 });
      const hasUIUXDocs = testResults.some(r => r.id?.startsWith('uiux-'));
      if (hasUIUXDocs) {
        console.log('[uiux] Search already initialized (warm container)');
        return;
      }
    } catch {
      // BM25 index empty or not ready — proceed with full initialization
    }
    await initUIUXSearch();
  })();
  return initPromise;
}
