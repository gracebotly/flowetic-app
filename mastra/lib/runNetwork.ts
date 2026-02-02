
import type { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { createFloweticSelectionCompletionScorer } from "../validation/selection-completion.scorer";

type GenerateRunOptions = {
  agent: Agent;
  message: string;
  requestContext: RequestContext;
  memory: { resource: string; thread: string };
  maxSteps?: number;
};

type GenerateTextResult = {
  text: string;
  steps?: any[];
};

export async function runAgentNetworkToText({
  agent,
  message,
  requestContext,
  memory,
  maxSteps = 10,
}: GenerateRunOptions): Promise<GenerateTextResult> {
  // NOTE:
  // We keep the exported function name `runAgentNetworkToText` to avoid touching
  // all callsites. Internally we now use Agent.generate() (Mastra v1 + AI SDK v5).
  //
  // This is intentional: network orchestration is causing excessive repeated model
  // resolution and higher variance execution time in serverless environments.

  const selectionScorer = createFloweticSelectionCompletionScorer({
    requirePhaseMatch: true,
    checkPrimitiveResultToo: true,
  });

  const result = await (agent as any).generate(message, {
    maxSteps,
    toolChoice: "auto",
    requestContext,
    memory,
    // Keep your existing validation/scorer behavior (generate supports scorers)
    scorers: {
      "flowetic-selection-completion": {
        scorer: selectionScorer.scorer,
        // sampling intentionally omitted (default behavior)
      },
    },
    // Return scorer data is not needed for UI; keep minimal payload.
    returnScorerData: false,
  });

  return {
    text: (result?.text ?? "").trim(),
    steps: result?.steps,
  };
}
