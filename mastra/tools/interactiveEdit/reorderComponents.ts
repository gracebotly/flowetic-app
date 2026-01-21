
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const LayoutSchema = z.object({
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

const ComponentSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.any()),
  layout: LayoutSchema,
});

const UISpecSchemaLoose = z.object({
  version: z.string(),
  templateId: z.string(),
  platformType: z.string(),
  layout: z.object({
    type: z.string(),
    columns: z.number(),
    gap: z.number(),
  }),
  components: z.array(ComponentSchema),
});

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const reorderComponents = createTool({
  id: "interactive.reorderComponents",
  description:
    "Deterministically reorder spec_json.components according to orderedIds. Missing ids appended in original order. Unknown ids ignored.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    orderedIds: z.array(z.string()).min(1).max(200),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    applied: z.string(),
  }),
  execute: async (inputData: any, context: any) => {
    const spec = deepClone(inputData.spec_json);
    const parsed = UISpecSchemaLoose.safeParse(spec);
    if (!parsed.success) throw new Error("SPEC_VALIDATION_FAILED");

    const components = parsed.data.components;
    const byId = new Map(components.map((c) => [c.id, c]));
    const seen = new Set<string>();

    const reordered: typeof components = [];
    for (const id of context.orderedIds) {
      const c = byId.get(id);
      if (!c) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      reordered.push(c);
    }
    for (const c of components) {
      if (seen.has(c.id)) continue;
      reordered.push(c);
    }

    spec.components = reordered;
    return { spec_json: spec, applied: "reorderComponents" };
  },
});
