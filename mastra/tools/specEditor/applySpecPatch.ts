

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

const PatchOpSchema = z.object({
  op: z.enum(["setDesignToken", "setLayout", "addComponent", "removeComponent", "updateComponentProps", "moveComponent"]),
  componentId: z.string().optional(),
  component: ComponentSchema.optional(),
  propsPatch: z.record(z.any()).optional(),
  layout: LayoutSchema.optional(),
  tokenPath: z.string().optional(),
  tokenValue: z.any().optional(),
});

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function setByPath(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]!] = value;
}

export const applySpecPatch = createTool({
  id: "applySpecPatch",
  description:
    "Apply a small, deterministic patch to a dashboard UI spec and/or design tokens. Returns updated spec_json + design_tokens.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).default({}),
    operations: z.array(PatchOpSchema).min(1).max(20),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
    applied: z.array(z.string()),
  }),
  execute: async (inputData, context) => {
    const spec = deepClone(inputData.spec_json);
    const tokens = deepClone(inputData.design_tokens ?? {});
    const applied: string[] = [];

    // Basic shape guard to keep edits sane
    const parsed = UISpecSchemaLoose.safeParse(spec);
    if (!parsed.success) {
      throw new Error("SPEC_VALIDATION_FAILED");
    }

    const ensureComponentsArray = () => {
      if (!Array.isArray(spec.components)) spec.components = [];
    };

    for (const op of inputData.operations) {
      if (op.op === "setDesignToken") {
        if (!op.tokenPath) throw new Error("PATCH_INVALID_TOKEN_PATH");
        setByPath(tokens, op.tokenPath, op.tokenValue);
        applied.push(`setDesignToken:${op.tokenPath}`);
        continue;
      }

      if (op.op === "setLayout") {
        if (!op.layout) throw new Error("PATCH_INVALID_LAYOUT");
        spec.layout = { ...spec.layout, ...op.layout };
        applied.push("setLayout");
        continue;
      }

      if (op.op === "addComponent") {
        ensureComponentsArray();
        if (!op.component) throw new Error("PATCH_INVALID_COMPONENT");
        const exists = spec.components.some((c: any) => c?.id === op.component!.id);
        if (exists) throw new Error(`DUPLICATE_COMPONENT_ID:${op.component.id}`);
        spec.components.push(op.component);
        applied.push(`addComponent:${op.component.id}`);
        continue;
      }

      if (op.op === "removeComponent") {
        ensureComponentsArray();
        if (!op.componentId) throw new Error("PATCH_MISSING_COMPONENT_ID");
        spec.components = spec.components.filter((c: any) => c?.id !== op.componentId);
        applied.push(`removeComponent:${op.componentId}`);
        continue;
      }

      if (op.op === "updateComponentProps") {
        ensureComponentsArray();
        if (!op.componentId) throw new Error("PATCH_MISSING_COMPONENT_ID");
        if (!op.propsPatch) throw new Error("PATCH_MISSING_PROPS_PATCH");
        const idx = spec.components.findIndex((c: any) => c?.id === op.componentId);
        if (idx < 0) throw new Error(`COMPONENT_NOT_FOUND:${op.componentId}`);
        spec.components[idx] = {
          ...spec.components[idx],
          props: { ...(spec.components[idx]?.props ?? {}), ...op.propsPatch },
        };
        applied.push(`updateComponentProps:${op.componentId}`);
        continue;
      }

      if (op.op === "moveComponent") {
        ensureComponentsArray();
        if (!op.componentId) throw new Error("PATCH_MISSING_COMPONENT_ID");
        if (!op.layout) throw new Error("PATCH_INVALID_LAYOUT");
        const idx = spec.components.findIndex((c: any) => c?.id === op.componentId);
        if (idx < 0) throw new Error(`COMPONENT_NOT_FOUND:${op.componentId}`);
        spec.components[idx] = {
          ...spec.components[idx],
          layout: { ...spec.components[idx].layout, ...op.layout },
        };
        applied.push(`moveComponent:${op.componentId}`);
        continue;
      }

      const _exhaustive: never = op.op;
      throw new Error(`UNKNOWN_PATCH_OP:${String(_exhaustive)}`);
    }

    return { spec_json: spec, design_tokens: tokens, applied };
  },
});

