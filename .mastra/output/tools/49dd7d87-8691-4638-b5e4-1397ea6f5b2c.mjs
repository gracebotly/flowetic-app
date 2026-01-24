import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const analyzeSchema = createTool({
  id: "analyze-schema",
  description: "Analyzes event schema from a data source to detect field types and patterns",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
    sampleSize: z.number().default(100)
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(["string", "number", "boolean", "date", "object", "array"]),
      sample: z.any(),
      nullable: z.boolean()
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }),
  execute: async (inputData, context) => {
    const { tenantId, sourceId, sampleSize } = inputData;
    const supabase = await createClient();
    const { data: events, error } = await supabase.from("events").select("*").eq("tenant_id", tenantId).eq("source_id", sourceId).order("created_at", { ascending: false }).limit(sampleSize);
    if (error || !events || events.length === 0) {
      throw new Error("NO_EVENTS_AVAILABLE");
    }
    const fieldMap = /* @__PURE__ */ new Map();
    const eventTypes = /* @__PURE__ */ new Set();
    events.forEach((event) => {
      eventTypes.add(event.type);
      const fields2 = event.labels || {};
      Object.entries(fields2).forEach(([key, value]) => {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { type: typeof value, samples: [], nullCount: 0 });
        }
        const field = fieldMap.get(key);
        if (value === null) {
          field.nullCount++;
        } else {
          field.samples.push(value);
        }
      });
      if (event.value !== null) {
        if (!fieldMap.has("value")) {
          fieldMap.set("value", { type: "number", samples: [], nullCount: 0 });
        }
        fieldMap.get("value").samples.push(event.value);
      }
      if (event.text) {
        if (!fieldMap.has("text")) {
          fieldMap.set("text", { type: "string", samples: [], nullCount: 0 });
        }
        fieldMap.get("text").samples.push(event.text);
      }
    });
    const fields = Array.from(fieldMap.entries()).map(([name, data]) => ({
      name,
      type: data.type,
      sample: data.samples[0],
      nullable: data.nullCount > 0
    }));
    const confidence = events.length >= 10 ? 0.9 : 0.6;
    return {
      fields,
      eventTypes: Array.from(eventTypes),
      confidence
    };
  }
});

export { analyzeSchema };
