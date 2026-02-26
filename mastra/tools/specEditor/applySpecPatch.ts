

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { InterfaceContextSchema } from "../../lib/REQUEST_CONTEXT_CONTRACT";
import { normalizeSpec } from "../../lib/spec/uiSpecSchema";
import { ComponentType } from "../../lib/spec/uiSpecSchema";

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
  meta: z.record(z.any()).optional(),
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
  requestContextSchema: InterfaceContextSchema,
  description:
    "Apply a small, deterministic patch to a dashboard UI spec and/or design tokens. " +
    "IMPORTANT: Always pass existing_design_tokens (the full tokens from getCurrentSpec) " +
    "to prevent token loss when using setDesignToken operations. " +
    "Returns updated spec_json + design_tokens.",
  inputSchema: z.object({
    spec_json: z.record(z.any()).optional().describe(
      "Full spec_json from getCurrentSpec. If omitted, the tool will auto-load the latest spec from the database using interfaceId from RequestContext."
    ),
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
    // ── Auto-load spec if not provided ────────────────────────────────
    // The agent SHOULD call getCurrentSpec first, but frequently doesn't.
    // Instead of failing with "spec_json: Required", load it ourselves.
    // This matches the pattern used by Linear/Notion plugin APIs where
    // mutation endpoints auto-resolve the current state.
    let rawSpecInput = inputData.spec_json;
    let autoLoadedTokens: Record<string, any> | undefined;

    if (!rawSpecInput || Object.keys(rawSpecInput).length === 0) {
      const interfaceId = context?.requestContext?.get('interfaceId') as string;
      const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;

      if (!interfaceId || !accessToken) {
        throw new Error(
          'SPEC_NOT_PROVIDED: spec_json was not passed and cannot be auto-loaded. ' +
          'Either pass spec_json directly or ensure interfaceId is in RequestContext. ' +
          'Call getCurrentSpec first to load the current spec.'
        );
      }

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabase = createClient(supabaseUrl, accessToken);

        const { data: versions, error: versionError } = await supabase
          .from('interface_versions')
          .select('id, spec_json, design_tokens')
          .eq('interface_id', interfaceId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (versionError) {
          throw new Error(`SPEC_AUTO_LOAD_FAILED: ${versionError.message}`);
        }

        if (!versions || versions.length === 0 || !versions[0].spec_json) {
          throw new Error(
            'SPEC_NOT_FOUND: No spec exists for this interface yet. ' +
            'Call generateUISpec first to create the initial dashboard spec.'
          );
        }

        rawSpecInput = versions[0].spec_json as Record<string, any>;
        autoLoadedTokens = versions[0].design_tokens as Record<string, any>;
        console.log('[applySpecPatch] Auto-loaded spec from DB:', {
          interfaceId,
          versionId: versions[0].id,
          componentCount: Array.isArray(rawSpecInput?.components) ? rawSpecInput.components.length : 0,
        });
      } catch (autoLoadErr: any) {
        if (autoLoadErr.message?.startsWith('SPEC_')) throw autoLoadErr;
        throw new Error(
          `SPEC_AUTO_LOAD_FAILED: Could not load spec from database. ${autoLoadErr.message}. ` +
          'Call getCurrentSpec first, then pass the spec_json to applySpecPatch.'
        );
      }
    }

    const rawSpec = deepClone(rawSpecInput);
    const spec = normalizeSpec(rawSpec) as Record<string, any>;
    // Deep-merge: if existing_design_tokens is provided, use it as the base
    // and merge inputData.design_tokens on top. This prevents the LLM from
    // accidentally dropping tokens by passing a sparse design_tokens object.
    const baseTokens = inputData.existing_design_tokens
      ? deepClone(inputData.existing_design_tokens)
      : autoLoadedTokens
        ? deepClone(autoLoadedTokens)
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
        // Phase 3: Validate component type against allowlist
        const typeCheck = ComponentType.safeParse(op.component.type);
        if (!typeCheck.success) {
          const validTypes = Array.isArray((ComponentType as any).options)
            ? (ComponentType as any).options.join(", ")
            : "MetricCard, LineChart, BarChart, PieChart, DonutChart, DataTable, TimeseriesChart, AreaChart, InsightCard, StatusFeed, HeroSection, FeatureGrid, PricingCards, CTASection, PageHeader, FilterBar, CRUDTable, AuthForm, EmptyStateCard";
          throw new Error(
            `INVALID_COMPONENT_TYPE: "${op.component.type}" is not in the component allowlist. Valid types: ${validTypes}`
          );
        }
        const exists = spec.components.some((c: any) => c?.id === op.component!.id);
        if (exists) throw new Error(`DUPLICATE_COMPONENT_ID:${op.component.id}`);
        // Phase 4: Inject explainability metadata for agent-added components
        const componentWithMeta = {
          ...op.component,
          meta: {
            ...(op.component.meta || {}),
            source: op.component.meta?.source ?? 'agent_edit',
            addedAt: op.component.meta?.addedAt ?? new Date().toISOString(),
            reason: op.component.meta?.reason ?? 'Added by agent via applySpecPatch',
          },
        };
        spec.components.push(componentWithMeta);
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
          meta: {
            ...(spec.components[idx]?.meta || {}),
            lastEditedAt: new Date().toISOString(),
            lastEditSource: 'agent_edit',
          },
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

    // Phase 2: Re-normalize after all patches applied.
    // Ensures newly added components have layout defaults (col/row/w/h)
    // and any structural invariants are restored.
    const normalizedOutput = normalizeSpec(spec) as Record<string, any>;
    return { spec_json: normalizedOutput, design_tokens: tokens, applied };
  },
});
