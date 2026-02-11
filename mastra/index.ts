// mastra/index.ts
import { Mastra } from "@mastra/core/mastra";
import { getMastraStorage } from "./lib/storage";

// Register real Mastra agents (NOT AG-UI AbstractAgent wrappers)
import { masterRouterAgent } from "./agents/masterRouterAgent";

// Workspace instance for skill discovery and file management
import { workspace } from "./workspace";

// Workflows
import { generatePreviewWorkflow } from "./workflows/generatePreview";
import { connectionBackfillWorkflow } from "./workflows/connectionBackfill";
import { deployDashboardWorkflow } from "./workflows/deployDashboard";
import { vibeJourneyWorkflow } from "./workflows/vibeJourneyWorkflow";
import { designSystemWorkflow } from "./workflows/designSystemWorkflow";

// =============================================================================
// CRITICAL: globalThis singleton pattern to prevent class duplication
//
// Turbopack/webpack can create multiple copies of this module in different
// chunks. Each copy would create a new Mastra instance with different class
// brands, causing "#workflows" private field errors.
//
// By storing the instance on globalThis, we ensure only ONE Mastra instance
// exists regardless of how many times this module is imported.
// =============================================================================

declare global {
  var __mastra: Mastra | undefined;
}

function createMastraInstance(): Mastra {
  if (process.env.DEBUG_MASTRA_BOOT === "true") {
    console.log("[Mastra boot] building Mastra instance");
    console.log("[Mastra boot] agent ids", ["masterRouterAgent"]);
  }

  return new Mastra({
    storage: getMastraStorage(),
    
    // Global workspace - all agents inherit this unless overridden
    workspace,
    
    agents: {
      masterRouterAgent,
    },
    workflows: {
      generatePreviewWorkflow,
      connectionBackfillWorkflow,
      deployDashboardWorkflow,
      vibeJourneyWorkflow,
      designSystemWorkflow,
    },
  });
}

// Use existing instance or create new one (survives HMR and chunk duplication)
globalThis.__mastra = globalThis.__mastra ?? createMastraInstance();

/**
 * The singleton Mastra instance.
 * ALWAYS import this directly - never use dynamic import() for mastra.
 */
export const mastra = globalThis.__mastra;

/**
 * Backward-compatible getter (for code that used getMastra())
 */
export function getMastra(): Mastra {
  return mastra;
}
