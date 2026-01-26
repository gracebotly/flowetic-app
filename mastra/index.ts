import { Mastra } from "@mastra/core/mastra";
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";
import { getMastraStorage } from "./lib/storage";

let _mastra: Mastra | null = null;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  _mastra = new Mastra({
    storage: getMastraStorage(),
    agents: {
      vibeRouterAgent,
    },
  });

  return _mastra;
}

/**
 * Backward-compatible export.
 * Many internal modules still import `{ mastra }` from "@/mastra" or "../../index".
 * This ensures no module-level DATABASE_URL capture while preserving the old import shape.
 */
export const mastra = new Proxy({} as Mastra, {
  get(_target, prop) {
    const instance = getMastra();
    return (instance as any)[prop];
  },
  has(_target, prop) {
    const instance = getMastra();
    return prop in (instance as any);
  },
}) as unknown as Mastra;
