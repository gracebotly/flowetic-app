import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  _store = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
  });

  return _store;
}