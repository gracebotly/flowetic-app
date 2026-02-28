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
  "UIHeader",
  "SectionHeader",
  "Pagination",
  "AuthForm",
  "EmptyStateCard",
  // Record-browser types (Phase 4)
  "ContentCard",
  "RecordList",
  "FilteredChart",
]);

export type ComponentType = z.infer<typeof ComponentType>;

// ── Phase 3: Component type alias resolution (server-side) ─────────────
// Mirrors componentRegistry.ts TYPE_ALIASES so normalization resolves
// aliases before strict ComponentType validation rejects them.
const TYPE_ALIASES: Record<string, string> = {
  "kpi-card": "MetricCard", kpi_card: "MetricCard", kpi: "MetricCard",
  "metric-card": "MetricCard",
  "line-chart": "LineChart", line_chart: "LineChart", chart: "LineChart",
  "bar-chart": "BarChart", bar_chart: "BarChart",
  "pie-chart": "PieChart", pie_chart: "PieChart",
  "donut-chart": "DonutChart", donut_chart: "DonutChart",
  "data-table": "DataTable", data_table: "DataTable", table: "DataTable",
  "timeseries-chart": "TimeseriesChart",
  "area-chart": "AreaChart",
  "insight-card": "InsightCard",
  "status-feed": "StatusFeed",
  "empty-state": "EmptyStateCard", "empty-state-card": "EmptyStateCard", empty_state: "EmptyStateCard",
  "hero-section": "HeroSection",
  "feature-grid": "FeatureGrid",
  "pricing-cards": "PricingCards",
  "cta-section": "CTASection",
  "social-proof-bar": "SocialProofBar",
  "page-header": "PageHeader",
  "filter-bar": "FilterBar",
  "crud-table": "CRUDTable",
  "ui-header": "UIHeader",
  "section-header": "SectionHeader",
  "auth-form": "AuthForm",
  "brand-visual": "BrandVisual",
  // Record-browser types (Phase 4)
  "content-card": "ContentCard", content_card: "ContentCard",
  "record-list": "RecordList", record_list: "RecordList",
  "filtered-chart": "FilteredChart", filtered_chart: "FilteredChart",
};

function resolveTypeAlias(rawType: string): string {
  if (TYPE_ALIASES[rawType]) return TYPE_ALIASES[rawType];
  const normalized = rawType.toLowerCase().replace(/[-_\s]/g, "");
  for (const [alias, canonical] of Object.entries(TYPE_ALIASES)) {
    if (alias.toLowerCase().replace(/[-_\s]/g, "") === normalized) return canonical;
  }
  return rawType; // Return as-is — validation will catch if truly unknown
}

// ── Layout schema ──────────────────────────────────────────────────────
export const LayoutSchema = z.object({
  col: z.number(),
  row: z.number(),
  w: z.number(),
  h: z.number(),
});

// ── Component schema ───────────────────────────────────────────────────
// ── Phase 4: Explainability metadata ───────────────────────────────────
export const ComponentMetaSchema = z.object({
  reason: z.string().optional(),
  source: z.enum([
    'workflow',
    'agent_edit',
    'interactive_edit',
    'skill_override',
    'heuristic',
    'manual',
  ]).optional(),
  fieldShape: z.string().optional(),
  fieldName: z.string().optional(),
  addedAt: z.string().optional(),
  lastEditedAt: z.string().optional(),
  lastEditSource: z.string().optional(),
  skeletonSlot: z.string().optional(),
}).optional();

export type ComponentMeta = z.infer<typeof ComponentMetaSchema>;

export const ComponentSchema = z.object({
  id: z.string(),
  type: ComponentType, // Phase 3: strict allowlist enforcement
  props: z.record(z.any()), // Phase 3: prop sanitization handled by propSchemas.ts at render/persist boundaries
  layout: LayoutSchema,
  meta: ComponentMetaSchema, // Phase 4: explainability metadata
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
    comp.type = resolveTypeAlias(comp.type || "MetricCard");
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
