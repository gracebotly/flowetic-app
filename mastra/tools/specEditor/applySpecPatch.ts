

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

/**
 * Deep-merge source into target. Source values win on conflict.
 * Only merges plain objects recursively; arrays and primitives are replaced.
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Normalize spec to ensure all required fields exist with valid defaults.
 * Prevents patch failures due to missing fields.
 */
function normalizeSpecForPatch(raw: Record<string, unknown>): Record<string, unknown> {
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

  // Normalize layout
  if (spec.layout && typeof spec.layout === "object") {
    const layoutObj = spec.layout as Record<string, unknown>;
    if (!layoutObj.type) layoutObj.type = "grid";
    if (typeof layoutObj.columns !== "number") layoutObj.columns = 12;
    if (typeof layoutObj.gap !== "number") layoutObj.gap = 16;
  } else {
    spec.layout = { type: "grid", columns: 12, gap: 16 };
  }

  return spec;
}

/**
 * Validate that all component IDs in patch operations exist in the spec.
 * Returns array of invalid IDs if any are found.
 */
function validateComponentIds(
  spec: Record<string, any>,
  operations: Array<{ op: string; componentId?: string; component?: any }>
): string[] {
  const existingIds = new Set<string>();

  // Collect all existing component IDs
  if (spec.components && Array.isArray(spec.components)) {
    for (const component of spec.components) {
      if (component.id) {
        existingIds.add(component.id);
      }
    }
  }

  const invalidIds: string[] = [];

  for (const op of operations) {
    // For update/move/remove operations, component must exist
    if (
      (op.op === "updateComponentProps" || op.op === "moveComponent" || op.op === "removeComponent") &&
      op.componentId
    ) {
      if (!existingIds.has(op.componentId)) {
        invalidIds.push(op.componentId);
      }
    }
  }

  return invalidIds;
}

export const applySpecPatch = createTool({
  id: "applySpecPatch",
  // Soft validation: tenantId optional because this is a pure transform,
  // but when present gives us audit trail
  requestContextSchema: z.object({
    tenantId: z.string().optional(),
  }),
  description:
    "Apply a small, deterministic patch to a dashboard UI spec and/or design tokens. " +
    "IMPORTANT: Always pass existing_design_tokens (the full tokens from getCurrentSpec) " +
    "to prevent token loss when using setDesignToken operations. " +
    "Returns updated spec_json + design_tokens.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).default({}),
    existing_design_tokens: z.record(z.any()).optional().describe(
      "Full design tokens from getCurrentSpec. When provided, design_tokens is deep-merged onto this base to prevent token loss."
    ),
    operations: z.array(PatchOpSchema).min(1).max(20),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
    applied: z.array(z.string()),
  }),
  execute: async (inputData, context) => {
    const rawSpec = deepClone(inputData.spec_json);
    const spec = normalizeSpecForPatch(rawSpec) as Record<string, any>;
    // Deep-merge: if existing_design_tokens is provided, use it as the base
    // and merge inputData.design_tokens on top. This prevents the LLM from
    // accidentally dropping tokens by passing a sparse design_tokens object.
    const baseTokens = inputData.existing_design_tokens
      ? deepClone(inputData.existing_design_tokens)
      : {};
    const incomingTokens = deepClone(inputData.design_tokens ?? {});
    const tokens = Object.keys(baseTokens).length > 0
      ? deepMerge(baseTokens, incomingTokens)
      : incomingTokens;
    const applied: string[] = [];

    // Basic shape guard to keep edits sane
    const parsed = UISpecSchemaLoose.safeParse(spec);
    if (!parsed.success) {
      throw new Error("SPEC_VALIDATION_FAILED");
    }

    // Validate component IDs before applying patches
    const invalidIds = validateComponentIds(spec, inputData.operations);
    if (invalidIds.length > 0) {
      const existingIds = spec.components?.map((c: any) => c.id) || [];
      throw new Error(
        `COMPONENT_NOT_FOUND: ${invalidIds.join(', ')}. Valid component IDs are: ${existingIds.join(', ')}. Call getCurrentSpec to see the current dashboard structure.`
      );
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

