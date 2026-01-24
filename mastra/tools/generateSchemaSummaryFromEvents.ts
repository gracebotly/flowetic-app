


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../lib/supabase";

function inferType(v: any): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "number") return Number.isInteger(v) ? "integer" : "number";
  if (t === "boolean") return "boolean";
  if (t === "string") return "string";
  if (t === "object") return "object";
  return "unknown";
}

function inferFieldType(value: any, events: any[]): string {
  return inferType(value);
}

export const generateSchemaSummaryFromEvents = createTool({
  id: "generateSchemaSummaryFromEvents",
  description:
    "Analyze stored events rows to infer a simple schema summary (fields, types, eventTypes, frequencies) for Phase 1 routing.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    sourceId: z.string().min(1),
    sampleSize: z.number().int().min(1).max(500).default(100),
  }),
  outputSchema: z.object({
    fields: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        sample: z.any().optional(),
        nullable: z.boolean().optional(),
      }),
    ),
    eventTypes: z.array(z.string()),
    eventCounts: z.record(z.number()),
    confidence: z.number().min(0).max(1),
  }),
  .execute(async (inputData, context) => {
    const { tenantId, sourceId, sampleSize = 100 } = inputData; // Default value

    const supabase = await createClient();

    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("source_id", sourceId)
      .order("timestamp", { ascending: false })
      .limit(sampleSize); // Now guaranteed to be a number

    if (error) throw new Error(error.message);

    const schema: any = {};
    const eventCounts: Record<string, number> = {};

    for (const event of events || []) {
      const eventType = event.event_type;
      eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;

      const payload = event.data;
      for (const key in payload) {
        if (!schema[key]) {
          schema[key] = {
            type: inferFieldType(payload[key], events),
            name: key,
            sample: payload[key],
            nullable: !Object.values(payload).some(v => v !== null),
          };
        }
      }
    }

    const eventTypes = Object.keys(schema);
    const fields = Object.values(schema);

    const { data: existingSummary, error: existingError } = await supabase
      .from("interface_schemas")
      .select("schema_json")
      .eq("source_id", sourceId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    let schemaJson = existingSummary?.schema_json;

    if (!schemaJson) {
      schemaJson = {
        fields,
        eventTypes,
        eventCounts,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      schemaJson = existingSummary.schema_json;
      schemaJson.lastUpdated = new Date().toISOString();
    }

    const { error: upsertError } = await supabase
      .from("interface_schemas")
      .upsert({
        source_id: sourceId,
        schema_json: schemaJson,
        tenant_id: tenantId,
      });

    if (upsertError) throw new Error(upsertError.message);

    return { schema: schemaJson, eventCounts, eventTypes };
  }),
});


