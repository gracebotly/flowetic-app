#!/usr/bin/env tsx
/**
 * Import UI/UX Pro Max CSV data into Supabase
 * 
 * Run once to populate uiux_data table:
 *   npx tsx scripts/import-uiux-data-to-supabase.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// Configuration - CSV files are in workspace/skills/ui-ux-pro-max/data/
const DATA_DIR = path.join(process.cwd(), 'workspace', 'skills', 'ui-ux-pro-max', 'data');

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

// Get Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importDomain(domain: string): Promise<number> {
  const filename = FILE_MAP[domain];
  if (!filename) {
    console.error(`Unknown domain: ${domain}`);
    return 0;
  }

  const filePath = path.join(DATA_DIR, filename);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const records: Record<string, string>[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      console.log(`No records in ${filename}`);
      return 0;
    }

    // Prepare batch insert
    const rows = records.map(row_data => ({
      domain,
      row_data: row_data,
    }));

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('uiux_data')
        .insert(batch);

      if (error) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }

      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${rows.length} rows for domain ${domain}`);
    }

    return inserted;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return 0;
  }
}

async function main() {
  console.log('Starting UI/UX data import to Supabase...');
  console.log(`Data directory: ${DATA_DIR}`);
  console.log();

  let totalInserted = 0;

  for (const domain of Object.keys(FILE_MAP)) {
    console.log(`Importing domain: ${domain}`);
    const count = await importDomain(domain);
    totalInserted += count;
    console.log(`  ✓ Imported ${count} rows for ${domain}`);
    console.log();
  }

  console.log(`✓ Import complete! Total rows inserted: ${totalInserted}`);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
