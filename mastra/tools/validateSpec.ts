import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { OptionalAuditContextSchema } from "../lib/REQUEST_CONTEXT_CONTRACT";

// ── Strict schema for a fully-formed spec ──────────────────────────────────
const UISpecSchema = z.object({
  version: z.string(),
  templateId: z.string(),
  platformType: z.string(),
  layout: z.object({
    type: z.string(),
    columns: z.number(),
    gap: z.number(),
  }),
  components: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      props: z.record(z.any()),
      layout: z.object({
        col: z.number(),
        row: z.number(),
        w: z.number(),
        h: z.number(),
      }),
    })
  ),
});

// ── Normalization: coerce agent-generated specs into the strict shape ───────
function normalizeSpec(raw: Record<string, unknown>): Record<string, unknown> {
  const spec = { ...raw };

  // Default version
  if (!spec.version || typeof spec.version !== "string") {
    spec.version = "1.0";
  }

  // Default templateId
  if (!spec.templateId || typeof spec.templateId !== "string") {
    spec.templateId = `agent-generated-${Date.now()}`;
  }

  // Default platformType
  if (!spec.platformType || typeof spec.platformType !== "string") {
    spec.platformType = "n8n";
  }

  // Normalize layout: string → object
  if (typeof spec.layout === "string") {
    spec.layout = {
      type: spec.layout,
      columns: 12,
      gap: 16,
    };
  } else if (spec.layout && typeof spec.layout === "object") {
    const layoutObj = spec.layout as Record<string, unknown>;
    // Ensure required fields exist with defaults
    if (!layoutObj.type || typeof layoutObj.type !== "string") {
      layoutObj.type = "grid";
    }
    if (typeof layoutObj.columns !== "number") {
      layoutObj.columns = 12;
    }
    if (typeof layoutObj.gap !== "number") {
      layoutObj.gap = 16;
    }
    spec.layout = layoutObj;
  } else {
    // No layout at all — provide default
    spec.layout = { type: "grid", columns: 12, gap: 16 };
  }

  // Ensure components is an array
  if (!Array.isArray(spec.components)) {
    spec.components = [];
  }

  // Normalize each component: ensure props and layout exist
  spec.components = (spec.components as any[]).map((comp: any) => ({
    ...comp,
    props: comp.props ?? {},
    layout: {
      col: comp.layout?.col ?? 0,
      row: comp.layout?.row ?? 0,
      w: comp.layout?.w ?? 4,
      h: comp.layout?.h ?? 2,
      ...comp.layout,
    },
  }));

  return spec;
}

export const validateSpec = createTool({
  id: "validate-spec",
  requestContextSchema: OptionalAuditContextSchema,
  description:
    "Validates dashboard UI specification against schema. " +
    "Auto-normalizes agent-generated specs (adds defaults for missing fields) before validation.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number().min(0).max(1),
  }),
  execute: async (inputData) => {
    const raw = inputData.spec_json;

    try {
      // Step 1: Normalize the spec (fill in agent-omitted defaults)
      const normalized = normalizeSpec(raw);

      // Step 2: Validate against the strict schema
      UISpecSchema.parse(normalized);

      // Step 3: Additional validation rules
      const errors: string[] = [];

      const components = normalized.components as any[];
      if (!components || components.length === 0) {
        errors.push("Spec must have at least one component");
      }

      // Check for duplicate component IDs
      const ids = new Set<string>();
      components?.forEach((comp: any) => {
        if (ids.has(comp.id)) {
          errors.push(`Duplicate component ID: ${comp.id}`);
        }
        ids.add(comp.id);
      });

      // Check layout constraints
      const layout = normalized.layout as { columns: number };
      components?.forEach((comp: any) => {
        if (comp.layout.col + comp.layout.w > layout.columns) {
          errors.push(`Component ${comp.id} exceeds grid width`);
        }
      });

      const valid = errors.length === 0;
      const score = valid ? 1.0 : Math.max(0, 1 - errors.length * 0.1);

      return { valid, errors, score };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [message],
        score: 0,
      };
    }
  },
});
