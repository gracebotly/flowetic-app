import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  // IMPORTANT:
  // Supabase already contains public.mastra_threads with snake_case columns (resource_id).
  // The current @mastra/pg version used at runtime is generating SQL that references
  // camelCase columns (resourceId). That mismatch causes:
  //   column "resourceId" of relation "mastra_threads" does not exist
  //
  // To fix this WITHOUT touching Supabase manually, we isolate Mastra into its own
  // set of tables using a different prefix. Mastra will auto-create the tables it
  // expects under that prefix.
  const tablePrefix = String(process.env.MASTRA_TABLE_PREFIX || "flowetic_mastra_");

  _store = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
    tablePrefix,
  } as any);

  return _store;
}