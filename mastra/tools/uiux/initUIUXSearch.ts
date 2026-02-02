
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
 * Load CSV rows (internal helper)
 */
async function loadCSV(domain: string): Promise<Record<string, string>[]> {
  const FILE_MAP: Record<string, string> = {
    style: 'styles.csv',
    color: 'colors.csv',
    chart: 'charts.csv',
    landing: 'landing.csv',
    product: 'products.csv',
    ux: 'ux-guidelines.csv',
    typography: 'typography.csv',
    icons: 'icons.csv',
    'web-interface': 'web-interface.csv',
  };

  const filename = FILE_MAP[domain];
  if (!filename) return [];

  const filePath = `/skills/ui-ux-pro-max/data/${filename}`;
  try {
    if (!workspace.filesystem) {
      console.error(`[uiux] Workspace filesystem is not configured`);
      return [];
    }
    
    const { parse } = await import('csv-parse/sync');
    const content = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' }) as string;
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return rows as Record<string, string>[];
  } catch (err) {
    console.error(`[uiux] Failed to read CSV: ${filePath}`, err);
    return [];
  }
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
