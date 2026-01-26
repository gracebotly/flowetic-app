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
