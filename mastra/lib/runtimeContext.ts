export type RuntimeContextLike = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

export function createRuntimeContext(initial?: Record<string, unknown>): RuntimeContextLike {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));
  return {
    get(key: string) {
      return store.get(key);
    },
    set(key: string, value: unknown) {
      store.set(key, value);
    },
  };
}

// Agent types for runtimeContext shim
export type DynamicAgentInstructions = ({ runtimeContext }: { runtimeContext: any }) => any;
