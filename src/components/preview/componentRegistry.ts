"use client";

import type { DeviceMode } from "@/components/vibe/editor";

// ============================================================================
// Shared types for all component renderers
// ============================================================================

export interface ComponentSpec {
  id: string;
  type: string;
  props?: Record<string, any>;
  layout?: {
    col?: number;
    row?: number;
    w?: number;
    h?: number;
  };
}

export interface DesignTokens {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    muted?: string;
  };
  borderRadius?: number;
  shadow?: string;
  fonts?: {
    heading?: string;
    body?: string;
  };
  spacing?: { unit?: number };
}

export interface RendererProps {
  component: ComponentSpec;
  designTokens: DesignTokens;
  deviceMode: DeviceMode;
  isEditing?: boolean;
  onClick?: () => void;
}

// ============================================================================
// Type normalization — single source of truth for ALL component types
// ============================================================================

const TYPE_ALIASES: Record<string, string> = {
  // Dashboard types
  "kpi-card": "MetricCard", kpi_card: "MetricCard", kpi: "MetricCard",
  "metric-card": "MetricCard", MetricCard: "MetricCard",
  "line-chart": "LineChart", line_chart: "LineChart", LineChart: "LineChart",
  chart: "LineChart",
  "bar-chart": "BarChart", bar_chart: "BarChart", BarChart: "BarChart",
  "pie-chart": "PieChart", pie_chart: "PieChart", PieChart: "PieChart",
  "donut-chart": "DonutChart", donut_chart: "DonutChart", DonutChart: "DonutChart",
  "data-table": "DataTable", data_table: "DataTable", DataTable: "DataTable",
  table: "DataTable",
  "timeseries-chart": "TimeseriesChart", TimeseriesChart: "TimeseriesChart",
  "area-chart": "AreaChart", AreaChart: "AreaChart",
  // Insight/Status types
  "insight-card": "InsightCard", InsightCard: "InsightCard",
  "status-feed": "StatusFeed", StatusFeed: "StatusFeed",
  // Product types
  "hero-section": "HeroSection", HeroSection: "HeroSection",
  "feature-grid": "FeatureGrid", FeatureGrid: "FeatureGrid",
  "pricing-cards": "PricingCards", PricingCards: "PricingCards",
  "cta-section": "CTASection", CTASection: "CTASection",
  "social-proof-bar": "SocialProofBar", SocialProofBar: "SocialProofBar",
  // Admin types
  "page-header": "PageHeader", PageHeader: "PageHeader",
  "filter-bar": "FilterBar", FilterBar: "FilterBar",
  "crud-table": "CRUDTable", CRUDTable: "CRUDTable",
  // Auth types
  "auth-form": "AuthForm", AuthForm: "AuthForm",
  "brand-visual": "BrandVisual", BrandVisual: "BrandVisual",
};

const KNOWN_TYPES = new Set([
  "MetricCard", "LineChart", "BarChart", "PieChart", "DonutChart", "DataTable",
  "TimeseriesChart", "AreaChart",
  "InsightCard", "StatusFeed",
  "HeroSection", "FeatureGrid", "PricingCards", "CTASection",
  "PageHeader", "FilterBar", "CRUDTable",
  "AuthForm",
]);

export function resolveComponentType(rawType: string): string {
  if (TYPE_ALIASES[rawType]) return TYPE_ALIASES[rawType];
  if (KNOWN_TYPES.has(rawType)) return rawType;
  const normalized = rawType.toLowerCase().replace(/[-_\s]/g, "");
  for (const [alias, canonical] of Object.entries(TYPE_ALIASES)) {
    if (alias.toLowerCase().replace(/[-_\s]/g, "") === normalized) return canonical;
  }
  return rawType; // Unknown — FallbackCard will handle it
}

export function isKnownType(resolvedType: string): boolean {
  return KNOWN_TYPES.has(resolvedType);
}

// ============================================================================
// Icon helper (shared across renderers)
// ============================================================================

export function getIconSymbol(iconName: string): string {
  const iconMap: Record<string, string> = {
    activity: "📊", "bar-chart": "📊", "pie-chart": "🍩",
    "line-chart": "📈", trending: "📈", "trending-up": "📈",
    zap: "⚡", clock: "⏱️", timer: "⏱️",
    users: "👥", user: "👤",
    check: "✅", "check-circle": "✅",
    alert: "⚠️", "alert-triangle": "⚠️",
    dollar: "💰", money: "💰",
    percent: "%", hash: "#",
    database: "🗄️", server: "🖥️", cpu: "⚙️", settings: "⚙️",
    shield: "🛡️", lock: "🔒", key: "🔑",
    mail: "✉️", inbox: "📥", star: "⭐", heart: "❤️",
    globe: "🌐", link: "🔗",
  };
  return iconMap[iconName?.toLowerCase()] || "📊";
}

// ============================================================================
// Shared card style builder
// ============================================================================

export function buildCardStyle(dt: DesignTokens): React.CSSProperties {
  const textColor = dt.colors?.text ?? "#111827";
  const bg = dt.colors?.background ?? "#ffffff";
  const isDark = bg.toLowerCase() < "#888888";
  const cardBg = isDark ? `${textColor}08` : "#ffffff";
  const borderRadius = dt.borderRadius ?? 8;
  const rawShadow = dt.shadow;
  const shadow = (() => {
    if (!rawShadow || rawShadow === "soft") return "0 1px 3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)";
    if (rawShadow === "medium") return "0 4px 6px rgba(0,0,0,0.1), 0 10px 15px rgba(0,0,0,0.05)";
    if (rawShadow === "hard") return "0 10px 25px rgba(0,0,0,0.15)";
    if (rawShadow === "none") return "none";
    if (typeof rawShadow === "string" && rawShadow.includes("px")) return rawShadow;
    return "0 1px 3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)";
  })();
  return {
    borderRadius: `${borderRadius}px`,
    boxShadow: shadow,
    backgroundColor: cardBg,
    borderColor: `${textColor}10`,
    overflow: "hidden",
  };
}
