// src/lib/spec/validateBeforeRender.ts
//
// Phase 5: Validation-before-render gate.
// Called at every render entry point (preview page, chat workspace).
//
// Dev mode: hard errors to catch upstream bugs.
// Production: drop + log for resilience.

import { normalizeSpec, UISpecSchema } from "@/mastra/lib/spec/uiSpecSchema";
import { resolveComponentType } from "@/components/preview/componentRegistry";
import { sanitizeProps } from "@/lib/spec/propSchemas";

const IS_DEV = process.env.NODE_ENV === "development";

export interface DroppedComponent {
  id: string;
  type: string;
  reason: "unknown_type" | "no_renderer" | "invalid_shape";
}

export interface RenderValidationResult {
  /** Cleaned spec safe for rendering. Null only if catastrophically invalid. */
  spec: Record<string, any> | null;
  /** Structured warnings for observability */
  warnings: string[];
  /** Components removed by catalog filter (with details for UI display) */
  droppedComponents: DroppedComponent[];
  /** Schema-level issues found */
  schemaIssues: string[];
}

/**
 * Validate and sanitize a UI spec before passing to the renderer.
 *
 * Pipeline:
 * 1. Normalize (fill defaults — idempotent)
 * 2. Schema validation (Zod — log, don't hard-reject at render time)
 * 3. Catalog filter: drop unknown types
 * 4. Prop sanitization: strip disallowed props per type
 * 5. Canonicalize type names (e.g., "kpi-card" → "MetricCard")
 *
 * Dev: console.error on unknown types (catch upstream generation bugs).
 * Prod: silent drop + structured log.
 */
export function validateBeforeRender(
  rawSpec: unknown,
): RenderValidationResult {
  if (!rawSpec || typeof rawSpec !== "object") {
    console.error("[validateBeforeRender] ❌ Spec is null or not an object");
    return {
      spec: null,
      warnings: ["Spec is null or not an object"],
      droppedComponents: [],
      schemaIssues: ["Spec is null or not an object"],
    };
  }

  const warnings: string[] = [];
  const droppedComponents: DroppedComponent[] = [];
  const schemaIssues: string[] = [];

  // ── Step 1: Normalize ──
  let spec: Record<string, any>;
  try {
    spec = normalizeSpec(rawSpec as Record<string, any>) as Record<string, any>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[validateBeforeRender] ❌ Normalization failed:", msg);
    return {
      spec: null,
      warnings: [`Normalization failed: ${msg}`],
      droppedComponents: [],
      schemaIssues: [msg],
    };
  }

  // ── Step 2: Schema validation (soft gate at render time) ──
  const parseResult = UISpecSchema.safeParse(spec);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    schemaIssues.push(...issues);
    warnings.push(...issues.map((i) => `[Schema] ${i}`));
    console.warn(
      `[validateBeforeRender] ⚠️ Schema: ${issues.length} issue(s)`,
      issues.slice(0, 5),
    );
  }

  // ── Step 3 + 4 + 5: Catalog filter → sanitize → canonicalize ──
  if (Array.isArray(spec.components)) {
    const originalCount = spec.components.length;

    spec.components = spec.components
      .map((comp: any) => {
        if (!comp || typeof comp !== "object") {
          droppedComponents.push({
            id: comp?.id ?? "unknown",
            type: comp?.type ?? "null",
            reason: "invalid_shape",
          });
          return null;
        }

        const resolved = resolveComponentType(comp.type);

        if (!resolved) {
          droppedComponents.push({
            id: comp.id ?? "unknown",
            type: comp.type,
            reason: "unknown_type",
          });

          if (IS_DEV) {
            console.error(
              `[validateBeforeRender] 🛑 DEV: Unknown type="${comp.type}" id="${comp.id}". ` +
              `Fix generateUISpec or applySpecPatch upstream — do NOT add a FallbackCard.`
            );
          }

          return null;
        }

        const cleanProps = sanitizeProps(resolved, comp.props ?? {});

        return {
          ...comp,
          type: resolved,
          props: cleanProps,
        };
      })
      .filter(Boolean);

    if (droppedComponents.length > 0) {
      console.warn(
        `[validateBeforeRender] 🧹 Dropped ${droppedComponents.length}/${originalCount} component(s)`,
        droppedComponents.map((d) => `${d.type} (${d.reason})`),
      );
    }
  }

  return { spec, warnings, droppedComponents, schemaIssues };
}
