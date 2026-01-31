
import type { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { createFloweticSelectionCompletionScorer } from "../validation/selection-completion.scorer";

type NetworkRunOptions = {
  agent: Agent;
  message: string;
  requestContext: RequestContext;
  memory: { resource: string; thread: string };
  maxSteps?: number;
};

type NetworkTextResult = {
  text: string;
  events: any[];
};

export async function runAgentNetworkToText({
  agent,
  message,
  requestContext,
  memory,
  maxSteps = 10,
}: NetworkRunOptions): Promise<NetworkTextResult> {
  const events: any[] = [];
  
  const selectionScorer = createFloweticSelectionCompletionScorer({
    requirePhaseMatch: true,
    checkPrimitiveResultToo: true,
  });

  const stream = await (agent as any).network(message, {
    maxSteps,
    toolChoice: "auto",
    requestContext,
    memory,
    validation: {
      scorers: [
        {
          scorer: selectionScorer.scorer,
          run: selectionScorer.run,
        },
      ],
    },
  });

  let finalText = "";

  for await (const chunk of stream) {
    events.push(chunk);

    // Best-effort extraction across mastra versions/event shapes
    const type = chunk?.type;
    if (type === "network-execution-event-step-finish") {
      const text =
        chunk?.payload?.result?.text ??
        chunk?.payload?.result?.output?.text ??
        chunk?.payload?.result?.final?.text ??
        chunk?.payload?.result?.content ??
        "";
      if (typeof text === "string" && text.trim()) finalText = text.trim();
    }

    // Some versions may just emit a final output event
    if (type === "agent-execution-end") {
      const text =
        chunk?.payload?.result?.text ??
        chunk?.payload?.result?.output?.text ??
        "";
      if (typeof text === "string" && text.trim()) finalText = text.trim();
    }
  }

  if (!finalText) {
    // Fallback: try last event payload search
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      const candidate =
        e?.payload?.result?.text ??
        e?.payload?.result?.output?.text ??
        e?.payload?.text ??
        "";
      if (typeof candidate === "string" && candidate.trim()) {
        finalText = candidate.trim();
        break;
      }
    }
  }

  return { text: finalText, events };
}
