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
// INVARIANT: This function is idempotent. normalizeSpec(normalizeSpec(x)) === normalizeSpec(x).
// It ONLY fills missing fields. It NEVER overwrites valid values, regenerates IDs, or mutates timestamps.
export function normalizeSpec(raw: Record<string, unknown>): Record<string, unknown> {
  const spec = { ...raw };
  const corrections: string[] = [];

  if (!spec.version || typeof spec.version !== "string") {
    spec.version = "1.0";
    corrections.push("version");
  }

  if (!spec.templateId || typeof spec.templateId !== "string") {
    spec.templateId = `agent-generated-${Date.now()}`;
    corrections.push("templateId");
  }

  if (!spec.platformType || typeof spec.platformType !== "string") {
    spec.platformType = "n8n";
    corrections.push("platformType");
  }

  if (typeof spec.layout === "string") {
    spec.layout = { type: spec.layout, columns: 12, gap: 16 };
    corrections.push("layout(string→object)");
  } else if (spec.layout && typeof spec.layout === "object") {
    const layoutObj = spec.layout as Record<string, unknown>;
    if (!layoutObj.type || typeof layoutObj.type !== "string") { layoutObj.type = "grid"; corrections.push("layout.type"); }
    if (typeof layoutObj.columns !== "number") { layoutObj.columns = 12; corrections.push("layout.columns"); }
    if (typeof layoutObj.gap !== "number") { layoutObj.gap = 16; corrections.push("layout.gap"); }
    spec.layout = layoutObj;
  } else {
    spec.layout = { type: "grid", columns: 12, gap: 16 };
    corrections.push("layout(missing)");
  }

  if (!Array.isArray(spec.components)) {
    spec.components = [];
    corrections.push("components(missing)");
  }

  let componentCorrections = 0;
  spec.components = (spec.components as any[]).map((comp: any) => {
    const needsProps = comp.props == null;
    const needsLayout = !comp.layout?.col && comp.layout?.col !== 0
      || !comp.layout?.row && comp.layout?.row !== 0
      || !comp.layout?.w || !comp.layout?.h;
    if (needsProps || needsLayout) componentCorrections++;
    return {
      ...comp,
      props: comp.props ?? {},
      layout: {
        col: comp.layout?.col ?? 0,
        row: comp.layout?.row ?? 0,
        w: comp.layout?.w ?? 4,
        h: comp.layout?.h ?? 2,
        ...comp.layout,
      },
    };
  });

  if (componentCorrections > 0) {
    corrections.push(`components(${componentCorrections} patched)`);
  }

  // Observability: log when normalization applies structural corrections
  if (corrections.length > 0) {
    console.log(`[normalizeSpec] Applied ${corrections.length} correction(s): ${corrections.join(", ")}`);
  }

  return spec;
}
