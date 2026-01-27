import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

type NormalizedListMessagesResult<T = any> = {
  messages: T[];
  total: number;
  hasMore: boolean;
};

function normalizeListMessagesResult<T = any>(value: unknown): NormalizedListMessagesResult<T> {
  // Most common expected shape from memory APIs: { messages, total, hasMore }
  if (value && typeof value === "object") {
    const v = value as any;

    // Defensive: some buggy implementations may return array directly, or messages under a different key.
    const messages = Array.isArray(v.messages)
      ? (v.messages as T[])
      : Array.isArray(v.items)
        ? (v.items as T[])
        : Array.isArray(v)
          ? (v as T[])
          : [];

    const total =
      typeof v.total === "number"
        ? v.total
        : typeof v.count === "number"
          ? v.count
          : messages.length;

    const hasMore = typeof v.hasMore === "boolean" ? v.hasMore : false;

    return { messages, total, hasMore };
  }

  // If something returned an array directly, treat it as messages.
  if (Array.isArray(value)) {
    return { messages: value as any[], total: (value as any[]).length, hasMore: false };
  }

  // null/undefined/anything else
  return { messages: [], total: 0, hasMore: false };
}

function wrapMemoryDomainStore(memoryStore: any): any {
  if (!memoryStore || typeof memoryStore !== "object") return memoryStore;

  // Avoid double-wrapping if hot reload or multiple calls happen
  if ((memoryStore as any).__floweticWrapped) return memoryStore;

  return new Proxy(memoryStore, {
    get(target, prop, receiver) {
      if (prop === "__floweticWrapped") return true;

      if (prop === "listMessages") {
        return async (...args: any[]) => {
          const raw = await (target as any).listMessages(...args);
          return normalizeListMessagesResult(raw);
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

function wrapStore(store: PostgresStore): PostgresStore {
  const originalGetStore = store.getStore.bind(store);

  type GetStoreDomain = Parameters<PostgresStore["getStore"]>[0];

  (store as any).getStore = async (domain: GetStoreDomain) => {
    const s = await originalGetStore(domain);
    if (domain === ("memory" as GetStoreDomain)) return wrapMemoryDomainStore(s);
    return s;
  };

  return store;
}

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  const store = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
  });

  _store = wrapStore(store);
  return _store;
}