




import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const proposeMapping = createTool({
  id: "proposeMapping",
  description:
    "Propose a mapping from observed schema fields to template-required keys. Returns missing required fields and confidence.",
  inputSchema: z.object({
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "activepieces", "make"]),
    templateId: z.string(),
    schemaFields: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean() })),
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {

    const { templateId, schemaFields } = context;
    const available = schemaFields.map((f) => f.name);
    const lower = schemaFields.map((f) => f.name.toLowerCase());

    const findFirst = (candidates: string[]) => {
      for (const c of candidates) {
        const idx = lower.findIndex((n) => n === c || n.includes(c));
        if (idx >= 0) return available[idx];
      }
      return null;
    };

    const templateRequirements: Record<string, string[]> = {
      "voice-analytics": ["timestamp", "duration", "status"],
      "workflow-monitor": ["timestamp", "status"],
      "general-analytics": ["timestamp"],
    };

    const required = templateRequirements[templateId] ?? ["timestamp"];

    const mappings: Record<string, string> = {};

    const timestamp = findFirst(["timestamp", "created_at", "createdat", "time", "event_time"]);
    const duration = findFirst(["call_duration", "duration", "call_length", "duration_seconds", "call_duration_seconds"]);
    const status = findFirst(["status", "call_status", "outcome", "execution_status"]);

    if (timestamp) mappings.timestamp = timestamp;
    if (duration) mappings.duration = duration;
    if (status) mappings.status = status;

    const missingFields = required.filter((r) => !mappings[r]);

    const confidence =
      required.length === 0 ? 1 : (required.length - missingFields.length) / required.length;

    return { mappings, missingFields, confidence };
  },
});





