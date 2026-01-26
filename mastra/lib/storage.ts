import { PostgresStore } from "@mastra/pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
}

export const mastraStorage = new PostgresStore({
  id: "flowetic-pg",
  connectionString: url,
});
