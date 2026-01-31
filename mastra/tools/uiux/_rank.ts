
import type { UIUXCSVRow } from "./loadUIUXCSV";

export function rankRowsByQuery(params: {
  rows: UIUXCSVRow[];
  query: string;
  limit: number;
}): UIUXCSVRow[] {
  const { rows, query, limit } = params;

  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) return [];

  const scored = rows
    .map((row) => {
      const text = Object.values(row).join(" ").toLowerCase();
      const score = tokens.reduce((sum, token) => (text.includes(token) ? sum + 1 : sum), 0);
      return { row, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.row);

  return scored;
}
