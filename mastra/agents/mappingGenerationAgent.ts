





import { createAgent } from "@mastra/core/agent";
import { z } from "zod";
import { 
  appendThreadEvent 
} from "../tools/platformMapping";
import { loadSkillMarkdown } from "../skills/loadSkill";
import { openai } from "@ai-sdk/openai";

export const mappingGenerationAgent = createAgent({
  name: "MappingGenerationAgent",
  instructions: `You are an intelligent field mapping agent.

Your workflow:
1. Load skill markdown to get Mapping heuristics (if present)
2. Derive character indexes to locate words from vocab/capabilities in record events
3. Build and return stable mappings object with confidence > 0.7
4. Use appendThreadEvent to log short mapping rationale suggestions

Always:
- Extract exact properties from tool results  
- Never guess property names
- Build deterministic mappings based on skill guidance
- Log mapping rationale in appendThreadEvent
- Only return mappings with confidence > 0.7`,
  model: openai("gpt-4o"),
  tools: {
    appendThreadEvent,
    // Note: loadSkillMarkdown is an async function, not a tool
  },
  // We'll need to handle loadSkillMarkdown in the workflow or route
});







