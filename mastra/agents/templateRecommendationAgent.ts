





import { createAgent } from "@mastra/core/agent";
import { z } from "zod";
import { 
  appendThreadEvent 
} from "../tools/platformMapping";
import { loadSkillMarkdown } from "../skills/loadSkill";
import { openai } from "@ai-sdk/openai";

export const templateRecommendationAgent = createAgent({
  name: "TemplateRecommendationAgent",
  instructions: `You are a deterministic template recommendation agent.

Your workflow:
1. Load skill markdown via loadSkillMarkdown(platform) to read Templates field
2. Analyze schema from event_samples to recommend best template from that skill
3. Do NOT hallucinate templates—only use what's listed in the loaded Skill.md
4. Use appendThreadEvent to log short rationale (1 sentence) per decision

Always:
- Extract exact properties from tool results
- Never guess property names
- Use only templates explicitly listed in the loaded skill markdown
- Keep rationale messages brief and specific`,
  model: openai("gpt-4o"),
  tools: {
    appendThreadEvent,
    // Note: loadSkillMarkdown is an async function, not a tool
  },
  // We'll need to handle loadSkillMarkdown in the workflow or route
});





