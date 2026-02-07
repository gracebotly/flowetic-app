import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  const baseStorage = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
  });

  // After creating the base storage instance, override snapshot persistence
  // to prevent PK collisions from Mastra's internal agentic-loop workflow.
  // Chat agents don't need workflow snapshots — only suspendable workflows do.
  const storage = new Proxy(baseStorage, {
    get(target, prop, receiver) {
      if (prop === 'persistWorkflowSnapshot') {
        return async (...args: any[]) => {
          try {
            return await target.persistWorkflowSnapshot(...args);
          } catch (err: any) {
            if (err?.message?.includes('duplicate key') && err?.message?.includes('mastra_workflow_snapshot')) {
              console.warn('[Storage] Suppressed snapshot PK collision (expected in serverless)');
              return; // Swallow the collision — chat doesn't need snapshots
            }
            throw err; // Re-throw non-collision errors
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  _store = storage as PostgresStore;

  return _store;
}