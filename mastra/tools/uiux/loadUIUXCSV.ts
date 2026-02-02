
import { workspace } from '@/mastra/workspace';
import { parse } from 'csv-parse/sync';

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

/**
 * Load CSV from workspace filesystem.
 * CSV files are at: /skills/ui-ux-pro-max/data/{filename}
 */
export async function loadUIUXCSV(domain: string): Promise<UIUXCSVRow[]> {
  const filename = FILE_MAP[domain];
  if (!filename) {
    console.error(`[uiux] Unknown domain: ${domain}`);
    return [];
  }

  const filePath = `/skills/ui-ux-pro-max/data/${filename}`;
  try {
    if (!workspace.filesystem) {
      console.error(`[uiux] Workspace filesystem is not configured`);
      return [];
    }
    
    const content = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' }) as string;
    const records: UIUXCSVRow[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records;
  } catch (err) {
    console.error(`[uiux] Failed to read CSV: ${filePath}`, err);
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
