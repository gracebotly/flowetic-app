
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

const cache = new Map<string, UIUXCSVRow[]>();

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_ENV_MISSING: require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY)'
    );
  }

  return createClient(url, anonKey);
}

export async function loadUIUXCSV(domain: string): Promise<UIUXCSVRow[]> {
  // validate domain early (same behavior as before)
  const filename = FILE_MAP[domain];
  if (!filename) {
    console.error(`[uiux] Unknown domain: ${domain}`);
    return [];
  }

  // cache
  const cached = cache.get(domain);
  if (cached) return cached;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('uiux_data')
      .select('row_data')
      .eq('domain', domain);

    if (error) {
      console.error(`[uiux] Failed to query uiux_data for domain=${domain}`, error);
      return [];
    }

    const rows = (data ?? []).map((r: any) => (r?.row_data ?? {}) as UIUXCSVRow);

    cache.set(domain, rows);
    return rows;
  } catch (err) {
    console.error(`[uiux] Failed to load UI/UX data from Supabase for domain=${domain}`, err);
    return [];
  }
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
