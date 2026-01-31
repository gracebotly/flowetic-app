import { Mastra } from "@mastra/core/mastra";
import { getMastraStorage } from "./lib/storage";

// Register real Mastra agents (NOT AG-UI AbstractAgent wrappers)
import { masterRouterAgent } from "./agents/masterRouterAgent";

// Workflows
import { generatePreviewWorkflow } from "./workflows/generatePreview";
import { connectionBackfillWorkflow } from "./workflows/connectionBackfill";
import { deployDashboardWorkflow } from "./workflows/deployDashboard";
import { vibeJourneyWorkflow } from "./workflows/vibeJourneyWorkflow";

let _mastra: Mastra | null = null;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  if (process.env.DEBUG_MASTRA_BOOT === "true") {
    console.log("[Mastra boot] building Mastra instance");
    console.log("[Mastra boot] agent ids", ["masterRouterAgent"]);
  }

  _mastra = new Mastra({
    storage: getMastraStorage(),
    agents: {
      masterRouterAgent,
    },
    workflows: {
      generatePreviewWorkflow,
      connectionBackfillWorkflow,
      deployDashboardWorkflow,
      vibeJourneyWorkflow,
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
