// src/lib/spec/propSchemas.ts
//
// Phase 3: Per-component-type prop allowlists and sanitizer.
// Strips unknown/unsafe props before rendering.
// Design principle: allow-list only. If a prop isn't listed, it's removed.
// Exception: "data" props are handled by transformDataForComponents at render time.

// ============================================================================
// Allowed props per component type
// ============================================================================

const UNIVERSAL_PROPS = new Set([
  "title", "subtitle", "description", "hidden", "dominant",
  "icon", "iconName", "className",
]);

const CHART_COMMON_PROPS = new Set([
  "xAxisField", "yAxisField", "categoryField", "valueField",
  "xAxisLabel", "yAxisLabel",
  "data", "series", "colors", "showLegend", "showGrid",
  "stacked", "horizontal",
]);

const ALLOWED_PROPS: Record<string, Set<string>> = {
  MetricCard: new Set([
    ...UNIVERSAL_PROPS,
    "value", "valueField", "delta", "deltaField", "unit", "aggregation",
    "format", "prefix", "suffix", "trend", "trendDelta", "sparkline", "color",
    "variant", "showTrend",
  ]),
  LineChart: new Set([
    ...UNIVERSAL_PROPS, ...CHART_COMMON_PROPS,
    "xKey", "yKey", "interval", "yFormat", "curveType", "showDots",
  ]),
  TimeseriesChart: new Set([
    ...UNIVERSAL_PROPS, ...CHART_COMMON_PROPS,
    "xKey", "yKey", "interval", "yFormat", "curveType", "showDots",
  ]),
  AreaChart: new Set([
    ...UNIVERSAL_PROPS, ...CHART_COMMON_PROPS,
    "xKey", "yKey", "interval", "yFormat", "curveType", "fillOpacity",
  ]),
  BarChart: new Set([
    ...UNIVERSAL_PROPS, ...CHART_COMMON_PROPS,
    "barSize", "layout",
  ]),
  PieChart: new Set([
    ...UNIVERSAL_PROPS, ...CHART_COMMON_PROPS,
    "innerRadius", "outerRadius", "showLabels", "labelField",
  ]),
  DonutChart: new Set([
    ...UNIVERSAL_PROPS, ...CHART_COMMON_PROPS,
    "innerRadius", "outerRadius", "showLabels", "labelField", "centerLabel",
  ]),
  DataTable: new Set([
    ...UNIVERSAL_PROPS,
    "columns", "rows", "data", "pageSize", "sortable", "filterable",
    "pagination", "sort", "maxRows",
  ]),
  InsightCard: new Set([
    ...UNIVERSAL_PROPS,
    "insight", "severity", "source", "confidence", "actionLabel",
  ]),
  StatusFeed: new Set([
    ...UNIVERSAL_PROPS,
    "feedItems", "maxItems", "showTimestamp", "eventType",
  ]),
  HeroSection: new Set([
    ...UNIVERSAL_PROPS,
    "heading", "subheading", "ctaText", "ctaUrl", "backgroundImage",
    "alignment", "overlay",
  ]),
  FeatureGrid: new Set([
    ...UNIVERSAL_PROPS,
    "features", "columns", "iconSize",
  ]),
  PricingCards: new Set([
    ...UNIVERSAL_PROPS,
    "plans", "currency", "billingCycle", "highlightPlan",
  ]),
  CTASection: new Set([
    ...UNIVERSAL_PROPS,
    "heading", "subheading", "ctaText", "ctaUrl", "variant",
  ]),
  SocialProofBar: new Set([
    ...UNIVERSAL_PROPS,
    "metrics", "logos", "testimonials",
  ]),
  BrandVisual: new Set([
    ...UNIVERSAL_PROPS,
    "heading", "subheading", "backgroundImage", "logoUrl",
  ]),
  PageHeader: new Set([
    ...UNIVERSAL_PROPS,
    "heading", "breadcrumbs", "actions",
  ]),
  FilterBar: new Set([
    ...UNIVERSAL_PROPS,
    "filters", "layout",
  ]),

  UIHeader: new Set([
    ...UNIVERSAL_PROPS,
    "showGreeting", "greeting", "category",
  ]),
  SectionHeader: new Set([
    ...UNIVERSAL_PROPS,
    "sectionId",
  ]),
  CRUDTable: new Set([
    ...UNIVERSAL_PROPS,
    "columns", "rows", "data", "actions", "pageSize", "sortable",
    "filterable", "createLabel", "entityName",
  ]),
  Pagination: new Set([
    ...UNIVERSAL_PROPS,
    "totalPages", "currentPage", "pageSize",
  ]),
  AuthForm: new Set([
    ...UNIVERSAL_PROPS,
    "mode", "providers", "showForgotPassword", "redirectUrl",
  ]),
  EmptyStateCard: new Set([
    ...UNIVERSAL_PROPS,
    "message", "actionLabel", "actionUrl",
  ]),
};

// ============================================================================
// Props that are ALWAYS stripped (security: functions, scripts, dangerous keys)
// ============================================================================

const BLOCKED_PROP_PATTERNS = [
  /^on[A-Z]/, // onClick, onChange, etc. — no event handlers from LLM
  /^__/,       // __proto__, __internal, etc.
  /^dangerously/i, // dangerouslySetInnerHTML
];

function isBlockedProp(key: string): boolean {
  return BLOCKED_PROP_PATTERNS.some(pattern => pattern.test(key));
}

function isUnsafeValue(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower.includes("<script") || lower.includes("javascript:")) return true;
  }
  return false;
}

// ============================================================================
// Main sanitizer
// ============================================================================

/**
 * Sanitize component props against the per-type allowlist.
 * - Strips unknown props (not in allowlist for this component type)
 * - Strips blocked props (event handlers, __proto__, dangerously*)
 * - Strips unsafe values (functions, script injections)
 * - Returns a clean props object. Unknown component types get universal props only.
 *
 * This is a pure function with no side effects.
 */
export function sanitizeProps(
  componentType: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = ALLOWED_PROPS[componentType] ?? UNIVERSAL_PROPS;
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    // Block dangerous prop names
    if (isBlockedProp(key)) {
      console.warn(`[propSanitizer] 🚫 Blocked prop "${key}" on ${componentType}`);
      continue;
    }

    // Block unsafe values
    if (isUnsafeValue(value)) {
      console.warn(`[propSanitizer] 🚫 Unsafe value for prop "${key}" on ${componentType}`);
      continue;
    }

    // Allow only whitelisted props
    if (allowed.has(key)) {
      clean[key] = value;
    }
    // Silently drop unknown props (no warning spam — expected for LLM output)
  }

  return clean;
}

/**
 * Check if a component type has a registered prop schema.
 * Useful for observability/debugging.
 */
export function hasPropSchema(componentType: string): boolean {
  return componentType in ALLOWED_PROPS;
}
