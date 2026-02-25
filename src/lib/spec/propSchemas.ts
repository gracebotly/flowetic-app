// src/lib/spec/propSchemas.ts
//
// Phase 3: Per-component-type prop allowlists and sanitizer.
// Strips unknown/unsafe props before rendering.
// Design principle: allow-list only. If a prop isn't listed, it's removed.
// Exception: "data" props are handled by transformDataForComponents at render time.

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
    "format", "prefix", "suffix", "trend", "sparkline", "color",
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
    "filters", "onFilterChange", "layout",
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

const BLOCKED_PROP_PATTERNS = [
  /^on[A-Z]/,
  /^__/,
  /^dangerously/i,
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

export function sanitizeProps(
  componentType: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = ALLOWED_PROPS[componentType] ?? UNIVERSAL_PROPS;
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (isBlockedProp(key)) {
      console.warn(`[propSanitizer] 🚫 Blocked prop "${key}" on ${componentType}`);
      continue;
    }

    if (isUnsafeValue(value)) {
      console.warn(`[propSanitizer] 🚫 Unsafe value for prop "${key}" on ${componentType}`);
      continue;
    }

    if (allowed.has(key)) {
      clean[key] = value;
    }
  }

  return clean;
}

export function hasPropSchema(componentType: string): boolean {
  return componentType in ALLOWED_PROPS;
}
