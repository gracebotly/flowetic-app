import { Mastra } from "@mastra/core/mastra";
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";
import { getMastraStorage } from "./lib/storage";

// Add these imports
import { generatePreviewWorkflow } from './workflows/generatePreview';
import { connectionBackfillWorkflow } from './workflows/connectionBackfill';
import { deployDashboardWorkflow } from './workflows/deployDashboard';

let _mastra: Mastra | null = null;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  if (process.env.DEBUG_MASTRA_BOOT === "true") {
    console.log("[Mastra boot] versions", {
      mastraCore: require("@mastra/core/package.json").version,
      mastraPg: require("@mastra/pg/package.json").version,
      mastraMemory: require("@mastra/memory/package.json").version,
      agUiMastra: require("@ag-ui/mastra/package.json").version,
      agUiClient: require("@ag-ui/client/package.json").version,
    });
    console.log("[Mastra boot] agents keys", Object.keys({ vibeRouterAgent }));
    console.log("[Mastra boot] vibeRouterAgent type", typeof vibeRouterAgent, vibeRouterAgent?.constructor?.name);
    console.log("[Mastra boot] vibeRouterAgent keys sample", Object.keys(vibeRouterAgent || {}).slice(0, 30));
  }

  _mastra = new Mastra({
    storage: getMastraStorage(),
    agents: {
      vibeRouterAgent,
    },
    // Add workflows property
    workflows: {
      generatePreviewWorkflow,
      connectionBackfillWorkflow,
      deployDashboardWorkflow,
    },
  });

  if (process.env.DEBUG_MASTRA_BOOT === "true") {
    console.log("[Mastra boot] versions", {
      mastraCore: require("@mastra/core/package.json").version,
      mastraPg: require("@mastra/pg/package.json").version,
      mastraMemory: require("@mastra/memory/package.json").version,
      agUiMastra: require("@ag-ui/mastra/package.json").version,
      agUiClient: require("@ag-ui/client/package.json").version,
    });
    console.log("[Mastra boot] agents keys", Object.keys({ vibeRouterAgent }));
    console.log("[Mastra boot] vibeRouterAgent type", typeof vibeRouterAgent, vibeRouterAgent?.constructor?.name);
    console.log("[Mastra boot] vibeRouterAgent keys sample", Object.keys(vibeRouterAgent || {}).slice(0, 30));
  }

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
