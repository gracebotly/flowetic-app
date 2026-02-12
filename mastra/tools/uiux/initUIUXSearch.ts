
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
 * This avoids CSV parsing issues with malformed icons.csv and web-interface.csv
 * (unescaped quotes, inconsistent column counts).
 *
 * The data was imported to Supabase with relaxed CSV options, so it's already clean.
 */
async function loadCSV(domain: string): Promise<Record<string, string>[]> {
  // Delegate to the canonical Supabase loader which handles:
  // - uiux_data table queries
  // - In-memory caching
  // - Error handling
  const { loadUIUXCSV } = await import('./loadUIUXCSV');
  return loadUIUXCSV(domain);
}

/**
 * Initialize UI/UX search if not already done.
 * Safe to call multiple times (checks initialization status).
 */
let initialized = false;
export async function ensureUIUXSearchInitialized(): Promise<void> {
  if (initialized) return;
  
  // Simple check: search for any uiux document
  try {
    const testResults = await workspace.search('test', { topK: 1 });
    const hasUIUXDocs = testResults.some(r => r.id?.startsWith('uiux-'));
    
    if (hasUIUXDocs) {
      console.log('[uiux] Search already initialized');
      initialized = true;
      return;
    }
  } catch (err) {
    // Search might not be ready yet, continue with initialization
  }

  await initUIUXSearch();
  initialized = true;
}
