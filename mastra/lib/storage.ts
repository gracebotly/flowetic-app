import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  // IMPORTANT:
  // Your Supabase already has mastra_* tables with snake_case columns (resource_id),
  // but the current @mastra/pg runtime is issuing queries using camelCase (resourceId).
  // To avoid colliding with existing tables, we use a dedicated prefix so Mastra can
  // create a fresh set of tables with the column names it expects.
  //
  // This is a CODE-ONLY fix (no Supabase manual edits required).
  const prefix = String(process.env.MASTRA_TABLE_PREFIX || "flowetic_mastra_");

  _store = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
    tablePrefix: prefix,
  } as any);

  return _store;
}