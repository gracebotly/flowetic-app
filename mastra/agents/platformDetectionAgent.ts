





import { createAgent } from "@mastra/core/agent";
import { z } from "zod";
import { 
  appendThreadEvent 
} from "../tools/platformMapping";
import { openai } from "@ai-sdk/openai";

export const platformDetectionAgent = createAgent({
  name: "PlatformDetectionAgent",
  instructions: `You are a lightweight platform detection agent that operates first in the pipeline.

Your tasks:
1. Detect the platform type from the first record event
2. Return platform, sourceid, and the record events
3. Do NOT bake heuristics or templates into your tool calls
4. Always return events in array format exactly as received
5. Use appendThreadEvent to mark detections

Always extract exact property names and never pass whole result objects.`,
  model: openai("gpt-4o"),
  tools: {
    appendThreadEvent,
  },
});




