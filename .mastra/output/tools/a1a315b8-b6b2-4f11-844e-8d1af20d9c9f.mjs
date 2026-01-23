import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const selectTemplate = createTool({
  id: "select-template",
  description: "Selects the best dashboard template based on platform type and schema",
  inputSchema: z.object({
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "activepieces", "make"]),
    eventTypes: z.array(z.string()),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string()
    }))
  }),
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string()
  }),
  execute: async (inputData, context) => {
    const { platformType, eventTypes} = inputData;
    const hasMessages = eventTypes.includes("message");
    const hasMetrics = eventTypes.includes("metric");
    const hasToolEvents = eventTypes.includes("tool_event");
    let templateId = "default";
    let confidence = 0.7;
    let reason = "Using default template";
    if (platformType === "vapi" || platformType === "retell") {
      templateId = "voice-agent-dashboard";
      confidence = 0.95;
      reason = "Voice agent platform detected with call metrics";
    } else if (platformType === "n8n" || platformType === "mastra") {
      templateId = "workflow-dashboard";
      confidence = 0.9;
      reason = "Workflow automation platform with execution tracking";
    } else if (platformType === "crewai") {
      templateId = "multi-agent-dashboard";
      confidence = 0.85;
      reason = "Multi-agent orchestration platform";
    } else if (hasMessages && !hasMetrics) {
      templateId = "chat-dashboard";
      confidence = 0.7;
      reason = "Message-heavy data detected";
    } else if (hasToolEvents) {
      templateId = "workflow-dashboard";
      confidence = 0.75;
      reason = "Tool execution events detected";
    }
    return {
      templateId,
      confidence,
      reason
    };
  }
});

export { selectTemplate };
