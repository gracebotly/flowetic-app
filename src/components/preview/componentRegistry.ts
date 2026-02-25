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

// Re-export for backward compat — components that still call getIconSymbol
// will get a string fallback. New components should use getLucideIcon() instead.
export function getIconSymbol(iconName: string): string {
  // Minimal fallback for any component not yet upgraded to Lucide
  const fallback: Record<string, string> = {
    activity: "◆", check: "✓", "check-circle": "✓",
    alert: "!", "alert-triangle": "!",
    clock: "◷", timer: "◷", zap: "⚡",
  };
  return fallback[iconName?.toLowerCase()] || "◆";
}

/**
 * Maps prop icon names to Lucide React icon component names.
 * Used by MetricCard and other premium renderers.
 */
export function getLucideIconName(iconName: string): string {
  const map: Record<string, string> = {
    activity: "Activity",
    "bar-chart": "BarChart3",
    "pie-chart": "PieChart",
    "line-chart": "TrendingUp",
    trending: "TrendingUp",
    "trending-up": "TrendingUp",
    zap: "Zap",
    clock: "Clock",
    timer: "Timer",
    users: "Users",
    user: "User",
    check: "CheckCircle",
    "check-circle": "CheckCircle2",
    alert: "AlertTriangle",
    "alert-triangle": "AlertTriangle",
    dollar: "DollarSign",
    money: "DollarSign",
    percent: "Percent",
    hash: "Hash",
    database: "Database",
    server: "Server",
    cpu: "Cpu",
    settings: "Settings",
    shield: "Shield",
    lock: "Lock",
    key: "Key",
    mail: "Mail",
    inbox: "Inbox",
    star: "Star",
    heart: "Heart",
    globe: "Globe",
    link: "Link",
  };
  return map[iconName?.toLowerCase()] || "Activity";
}

// ============================================================================
// Shared card style builder
// ============================================================================

/**
 * Derive a surface color from background if not explicitly provided.
 * For light themes: slightly lighter or white-shifted from background.
 * For dark themes: slightly lighter from background.
 */
function deriveSurface(bg: string, surface?: string): string {
  if (surface) return surface;
  // If background is a light color, use white with slight transparency
  // If dark, lighten slightly
  const isDark = isColorDark(bg);
  if (isDark) {
    return lightenHex(bg, 15);
  }
  // Light bg: blend toward white
  return "rgba(255, 255, 255, 0.7)";
}

function deriveMuted(text: string, muted?: string): string {
  if (muted) return muted;
  return `${text}66`; // 40% opacity of text color
}

function isColorDark(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Perceived brightness
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function lightenHex(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Premium card style builder — glassmorphism-inspired.
 * Uses design token `surface` for card background (auto-derived if missing).
 * Creates frosted-glass effect with backdrop blur, subtle borders, and layered shadows.
 */
export function buildCardStyle(dt: DesignTokens): React.CSSProperties {
  const bg = dt.colors?.background ?? "#ffffff";
  const textColor = dt.colors?.text ?? "#111827";
  const primary = dt.colors?.primary ?? "#3b82f6";
  const isDark = isColorDark(bg);
  const surface = deriveSurface(bg, dt.colors?.surface);
  const muted = deriveMuted(textColor, dt.colors?.muted);
  const borderRadius = dt.borderRadius ?? 8;

  const rawShadow = dt.shadow;
  const shadow = (() => {
    if (!rawShadow || rawShadow === "soft")
      return isDark
        ? "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)"
        : "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)";
    if (rawShadow === "medium")
      return "0 4px 6px rgba(0,0,0,0.1), 0 10px 20px rgba(0,0,0,0.06)";
    if (rawShadow === "hard")
      return "0 10px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)";
    if (rawShadow === "none") return "none";
    if (typeof rawShadow === "string" && rawShadow.includes("px")) return rawShadow;
    return "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)";
  })();

  return {
    borderRadius: `${borderRadius}px`,
    boxShadow: shadow,
    backgroundColor: surface,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderColor: isDark ? `rgba(255,255,255,0.08)` : `rgba(0,0,0,0.06)`,
    borderWidth: "1px",
    borderStyle: "solid",
    overflow: "hidden",
    outlineColor: `${primary}20`,
    color: muted,
    transition: "box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease",
  };
}

/**
 * Premium hover card style — applied on mouseenter.
 * Cards lift slightly and shadow deepens.
 */
export function buildCardHoverStyle(dt: DesignTokens): React.CSSProperties {
  const bg = dt.colors?.background ?? "#ffffff";
  const primary = dt.colors?.primary ?? "#3b82f6";
  const isDark = isColorDark(bg);

  return {
    boxShadow: isDark
      ? `0 4px 12px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px ${primary}30`
      : `0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px ${primary}25`,
    transform: "translateY(-1px)",
    borderColor: `${primary}30`,
  };
}
