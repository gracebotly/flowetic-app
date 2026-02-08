import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  const baseStore = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
  });

  // Patch: swallow snapshot PK collisions from Mastra's internal agentic-loop.
  // Chat agents don't need workflow snapshots — only suspendable workflows do.
  const originalPersist = (baseStore as any).persistWorkflowSnapshot;
  if (typeof originalPersist === 'function') {
    (baseStore as any).persistWorkflowSnapshot = async function (...args: unknown[]) {
      try {
        return await originalPersist.apply(this, args);
      } catch (err: any) {
        if (err?.message?.includes('duplicate key') && err?.message?.includes('mastra_workflow_snapshot')) {
          console.warn('[Storage] Suppressed snapshot PK collision (expected in serverless)');
          return;
        }
        throw err;
      }
    };
  }

  _store = baseStore;
  return _store;
}