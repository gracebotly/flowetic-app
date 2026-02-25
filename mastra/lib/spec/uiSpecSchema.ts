import { z } from "zod";

// ── Canonical component types (allowlist) ──────────────────────────────
export const ComponentType = z.enum([
  "MetricCard",
  "LineChart",
  "BarChart",
  "PieChart",
  "DonutChart",
  "DataTable",
  "TimeseriesChart",
  "AreaChart",
  "InsightCard",
  "StatusFeed",
  "HeroSection",
  "FeatureGrid",
  "PricingCards",
  "CTASection",
  "SocialProofBar",
  "BrandVisual",
  "PageHeader",
  "FilterBar",
  "CRUDTable",
  "Pagination",
  "AuthForm",
  "EmptyStateCard",
]);

export type ComponentType = z.infer<typeof ComponentType>;

// ── Layout schema ──────────────────────────────────────────────────────
export const LayoutSchema = z.object({
  col: z.number(),
  row: z.number(),
  w: z.number(),
  h: z.number(),
});

// ── Component schema ───────────────────────────────────────────────────
export const ComponentSchema = z.object({
  id: z.string(),
  type: z.string(), // NOTE: kept as z.string() for Phase 1 backward compat.
  // Phase 3 will tighten to ComponentType.
  props: z.record(z.any()),
  layout: LayoutSchema,
});

// ── Full UI Spec schema ────────────────────────────────────────────────
export const UISpecSchema = z.object({
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

export type UISpec = z.infer<typeof UISpecSchema>;

// ── Normalizer (extracted from validateSpec.ts) ────────────────────────
// Coerces agent-generated specs into the strict shape by filling defaults.
export function normalizeSpec(raw: Record<string, unknown>): Record<string, unknown> {
  const spec = { ...raw };

  if (!spec.version || typeof spec.version !== "string") {
    spec.version = "1.0";
  }

  if (!spec.templateId || typeof spec.templateId !== "string") {
    spec.templateId = `agent-generated-${Date.now()}`;
  }

  if (!spec.platformType || typeof spec.platformType !== "string") {
    spec.platformType = "n8n";
  }

  if (typeof spec.layout === "string") {
    spec.layout = { type: spec.layout, columns: 12, gap: 16 };
  } else if (spec.layout && typeof spec.layout === "object") {
    const layoutObj = spec.layout as Record<string, unknown>;
    if (!layoutObj.type || typeof layoutObj.type !== "string") layoutObj.type = "grid";
    if (typeof layoutObj.columns !== "number") layoutObj.columns = 12;
    if (typeof layoutObj.gap !== "number") layoutObj.gap = 16;
    spec.layout = layoutObj;
  } else {
    spec.layout = { type: "grid", columns: 12, gap: 16 };
  }

  if (!Array.isArray(spec.components)) {
    spec.components = [];
  }

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
