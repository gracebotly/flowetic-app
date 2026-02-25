import { createTool } from "@mastra/core/tools";
import { autoFixSpec } from "../lib/specAutoFixer";
import { z } from "zod";
import { OptionalAuditContextSchema } from "../lib/REQUEST_CONTEXT_CONTRACT";
import { UISpecSchema, normalizeSpec } from "../lib/spec/uiSpecSchema";

export const validateSpec = createTool({
  id: "validateSpec",
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
    fixed_spec: z.record(z.any()).optional(),
  }),
  execute: async (inputData, context) => {
    const raw = inputData.spec_json;

    try {
      // Step 1: Normalize the spec (fill in agent-omitted defaults)
      const normalized = normalizeSpec(raw);

      // Step 2: Auto-fix (Phase 4) — deterministic repairs BEFORE validation
      // Reads design tokens from RequestContext if available
      let designTokensForFixer: Record<string, any> | undefined;
      try {
        const dtRaw = (context?.requestContext as any)?.get('designTokens') as string;
        if (dtRaw) {
          designTokensForFixer = JSON.parse(dtRaw);
        }
      } catch {
        // Non-fatal — fixer works without design tokens (just skips color validation)
      }

      const { spec: fixed, fixes, fixCount } = autoFixSpec(normalized, designTokensForFixer);

      if (fixCount > 0) {
        console.log(`[validateSpec] AutoFixer applied ${fixCount} fix(es) before validation`);
      }

      // Step 3: Validate the FIXED spec against the strict schema
      UISpecSchema.parse(fixed);

      // Step 4: Additional validation rules
      const errors: string[] = [];

      const components = fixed.components as any[];
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
      const layout = fixed.layout as { columns: number };
      components?.forEach((comp: any) => {
        if (comp.layout.col + comp.layout.w > layout.columns) {
          errors.push(`Component ${comp.id} exceeds grid width`);
        }
      });

      // Phase 4: Skeleton structure validation
      if (fixed.layoutSkeletonId) {
        // Reject if >1 component marked dominant
        const dominantCount = components?.filter(
          (c: any) => c.props?.dominant === true || c.layout?.dominant === true
        ).length || 0;
        if (dominantCount > 1) {
          errors.push(`Only 1 component can be dominant (found ${dominantCount})`);
        }
      }

      const valid = errors.length === 0;
      // Score the FIXED spec, with small penalty for each fix applied
      const baseScore = valid ? 1.0 : Math.max(0, 1 - errors.length * 0.1);
      const fixPenalty = fixCount * 0.02; // Small penalty per fix
      const score = Math.max(0, Math.min(1, baseScore - fixPenalty));

      return { valid, errors, score, fixed_spec: valid ? fixed : undefined };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [message],
        score: 0,
        fixed_spec: undefined,
      };
    }
  },
});
