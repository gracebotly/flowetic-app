
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type UIUXCSVRow = Record<string, string>;

const ROOT_PATH =
  process.env.UI_UX_PRO_MAX_ROOT ??
  path.join(process.cwd(), ".agent", "skills", "ui-ux-pro-max", "data");

const FILE_MAP: Record<string, string> = {
  style: "styles.csv",
  color: "colors.csv",
  chart: "charts.csv",
  landing: "landing.csv",
  product: "products.csv",
  ux: "ux-guidelines.csv",
  typography: "typography.csv",
  icons: "icons.csv",
  "web-interface": "web-interface.csv",
};

export async function loadUIUXCSV(domain: string): Promise<UIUXCSVRow[]> {
  const filename = FILE_MAP[domain];
  if (!filename) {
    console.error(`[uiux] Unknown domain: ${domain}`);
    return [];
  }

  const filePath = path.join(ROOT_PATH, filename);

  try {
    const content = await fs.readFile(filePath, "utf-8");
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
