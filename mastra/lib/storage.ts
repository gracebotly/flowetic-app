import { LibSQLStore } from "@mastra/libsql";

export const mastraStorage = new LibSQLStore({
  id: "mastra-storage",
  url: process.env.MASTRA_STORAGE_URL || "file:./mastra.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
