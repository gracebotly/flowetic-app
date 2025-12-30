





import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const recommendTemplates = createTool({
  id: "recommendTemplates",
  description: "Recommend up to 3 dashboard templates deterministically based on platform type and schema.",
  inputSchema: z.object({
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "pydantic_ai", "other"]),
    schemaSummary: z.object({
      eventTypes: z.array(z.string()),
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          nullable: z.boolean(),
        }),
      ),
    }),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        templateId: z.string(),
        confidence: z.number(),
        reason: z.string(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    const { platformType, schemaSummary } = context;

    const fields = new Set(schemaSummary.fields.map((f) => f.name.toLowerCase()));

    const templatesByPlatform: Record<
      string,
      Array<{ id: string; required: string[] }>
    > = {
      vapi: [{ id: "voice-analytics", required: ["duration", "status"] }],
      retell: [{ id: "voice-analytics", required: ["duration", "status"] }],
      n8n: [{ id: "workflow-monitor", required: ["status"] }],
      mastra: [{ id: "workflow-monitor", required: ["status"] }],
      crewai: [{ id: "workflow-monitor", required: ["status"] }],
      pydantic_ai: [{ id: "workflow-monitor", required: ["status"] }],
      other: [{ id: "general-analytics", required: [] }],
    };

    const candidates = templatesByPlatform[platformType] ?? templatesByPlatform.other;

    const scored = candidates.map((t) => {
      const matched = t.required.filter((r) => {
        for (const f of fields) {
          if (f.includes(r)) return true;
        }
        return false;
      }).length;

      const confidence = t.required.length === 0 ? 0.6 : matched / t.required.length;

      return {
        templateId: t.id,
        confidence,
        reason: t.required.length === 0 ? "Fallback template." : `Matched ${matched}/${t.required.length} required field patterns.`,
      };
    });

    scored.sort((a, b) => b.confidence - a.confidence);

    return { recommendations: scored.slice(0, 3) };
  },
});





