import { PostgresStore } from "@mastra/pg";

let _store: PostgresStore | null = null;

type NormalizedListMessagesResult<T = any> = {
  messages: T[];
  total: number;
  hasMore: boolean;
};

function normalizeListMessagesResult<T = any>(value: unknown): NormalizedListMessagesResult<T> {
  // If the implementation returns { messages, total, hasMore }
  if (value && typeof value === "object") {
    const v = value as any;

    // Some implementations might return { items: [...] } or similar
    const messages = Array.isArray(v.messages)
      ? (v.messages as T[])
      : Array.isArray(v.items)
        ? (v.items as T[])
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

  // If the implementation returns an array directly, accept it
  if (Array.isArray(value)) {
    return { messages: value as T[], total: (value as T[]).length, hasMore: false };
  }

  // null/undefined/anything else
  return { messages: [], total: 0, hasMore: false };
}

function wrapAnyObjectDeep<T extends object>(obj: T): T {
  const seen = new WeakMap<object, any>();

  const wrap = (target: any): any => {
    if (!target || (typeof target !== "object" && typeof target !== "function")) return target;
    if (seen.has(target)) return seen.get(target);

    const proxy = new Proxy(target, {
      get(t, prop, receiver) {
        const value = Reflect.get(t, prop, receiver);

        // Normalize ANY listMessages() we encounter (wherever Mastra calls it from)
        if (prop === "listMessages" && typeof value === "function") {
          return async (...args: any[]) => {
            const raw = await value.apply(t, args);
            return normalizeListMessagesResult(raw);
          };
        }

        // Pass through primitives as-is
        if (!value || (typeof value !== "object" && typeof value !== "function")) return value;

        // Recursively proxy nested objects/functions to catch listMessages deeper in graph
        return wrap(value);
      },
    });

    seen.set(target, proxy);
    return proxy;
  };

  return wrap(obj);
}

export function getMastraStorage(): PostgresStore {
  if (_store) return _store;

  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Mastra PostgresStore).");
  }

  const base = new PostgresStore({
    id: "flowetic-pg",
    connectionString: url,
  });

  // Wrap the entire store object so ANY path Mastra uses to reach listMessages is intercepted.
  _store = wrapAnyObjectDeep(base) as unknown as PostgresStore;

  return _store;
}