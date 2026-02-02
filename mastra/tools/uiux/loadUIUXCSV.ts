
import { workspace } from '@/mastra/workspace';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

export type UIUXCSVRow = Record<string, string>;

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

// In-memory cache to avoid repeated queries
const cache = new Map<string, UIUXCSVRow[]>();

/**
 * Get Supabase client for UI/UX data queries
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_CREDENTIALS_MISSING: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Load UI/UX CSV data from Supabase (serverless-compatible)
 * 
 * @param domain - Domain name (e.g., 'style', 'color', 'chart', 'ux', 'typography')
 * @returns Array of CSV rows as Record<string, string>
 */
export async function loadUIUXCSV(domain: string): Promise<UIUXCSVRow[]> {
  // Check cache first
  if (cache.has(domain)) {
    return cache.get(domain)!;
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('uiux_data')
    .select('row_data')
    .eq('domain', domain);

  if (error) {
    console.error(`[uiux] Failed to load domain ${domain}:`, error);
    return [];
  }

  const rows = data?.map(row => row.row_data as UIUXCSVRow) || [];

  // Cache result
  cache.set(domain, rows);

  return rows;
}

export async function loadAllUIUXCSV(): Promise<Record<string, UIUXCSVRow[]>> {
  const result: Record<string, UIUXCSVRow[]> = {};
  for (const domain of Object.keys(FILE_MAP)) {
    result[domain] = await loadUIUXCSV(domain);
  }
  return result;
}

/**
 * Clear in-memory cache (useful for testing or if data is updated)
 */
export function clearUIUXCache(): void {
  cache.clear();
}
