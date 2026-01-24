import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

function inferType(v) {
  if (v === null || v === void 0) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "number") return Number.isInteger(v) ? "integer" : "number";
  if (t === "boolean") return "boolean";
  if (t === "string") return "string";
  if (t === "object") return "object";
  return "unknown";
}
const generateSchemaSummaryFromEvents = createTool({
  id: "generateSchemaSummaryFromEvents",
  description: "Analyze stored events rows to infer a simple schema summary (fields, types, eventTypes, frequencies) for Phase 1 routing.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    sourceId: z.string().min(1),
    sampleSize: z.number().int().min(1).max(500).default(100)
  }),
  outputSchema: z.object({
    fields: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        sample: z.any().optional(),
        nullable: z.boolean().optional()
      })
    ),
    eventTypes: z.array(z.string()),
    eventCounts: z.record(z.number()),
    confidence: z.number().min(0).max(1)
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("events").select("type,name,state,labels,timestamp,source_id,tenant_id,platform_event_id").eq("tenant_id", inputData.tenantId).eq("source_id", inputData.sourceId).order("timestamp", { ascending: false }).limit(inputData.sampleSize);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const eventCounts = {};
    const fieldStats = {};
    for (const r of rows) {
      const eventType = String(r?.name ?? r?.type ?? "unknown");
      eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1;
      const raw = r?.state?.raw;
      if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw)) {
          const s = fieldStats[k] ??= { types: /* @__PURE__ */ new Set(), nullable: false };
          const t = inferType(v);
          s.types.add(t);
          if (v === null || v === void 0) s.nullable = true;
          if (s.sample === void 0 && v !== void 0) s.sample = v;
        }
      }
    }
    const fields = Object.entries(fieldStats).slice(0, 200).map(([name, s]) => ({
      name,
      type: Array.from(s.types).sort().join("|"),
      sample: s.sample,
      nullable: s.nullable
    }));
    const eventTypes = Object.keys(eventCounts);
    const confidence = Math.min(1, rows.length / Math.max(1, inputData.sampleSize)) * 0.7 + Math.min(0.3, fields.length / 200 * 0.3);
    return { fields, eventTypes, eventCounts, confidence };
  }
});

export { generateSchemaSummaryFromEvents };
