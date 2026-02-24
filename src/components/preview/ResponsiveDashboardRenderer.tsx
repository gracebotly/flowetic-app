"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type { DeviceMode } from "@/components/vibe/editor";
import { resolveComponentType, type ComponentSpec, type DesignTokens, type RendererProps } from "./componentRegistry";

// Dashboard components (always loaded — 90% of renders)
import { MetricCardRenderer } from "./components/MetricCard";
import { LineChartRenderer } from "./components/LineChart";
import { BarChartRenderer } from "./components/BarChart";
import { PieChartRenderer, DonutChartRenderer } from "./components/PieChart";
import { DataTableRenderer } from "./components/DataTable";

// Product/Admin/Insight components (lazy-loaded via dynamic import)
const InsightCardRenderer = dynamic(() => import("./components/InsightCard"), { ssr: false });
const StatusFeedRenderer = dynamic(() => import("./components/StatusFeed"), { ssr: false });
const HeroSectionRenderer = dynamic(() => import("./components/HeroSection"), { ssr: false });
const FeatureGridRenderer = dynamic(() => import("./components/FeatureGrid"), { ssr: false });
const PricingCardsRenderer = dynamic(() => import("./components/PricingCards"), { ssr: false });
const CTASectionRenderer = dynamic(() => import("./components/CTASection"), { ssr: false });
const PageHeaderRenderer = dynamic(() => import("./components/PageHeader"), { ssr: false });
const FilterBarRenderer = dynamic(() => import("./components/FilterBar"), { ssr: false });
const CRUDTableRenderer = dynamic(() => import("./components/CRUDTable"), { ssr: false });
const AuthFormRenderer = dynamic(() => import("./components/AuthForm"), { ssr: false });
const FallbackCardRenderer = dynamic(() => import("./components/FallbackCard"), { ssr: false });

// ── Renderer map ──
const RENDERER_MAP: Record<string, React.ComponentType<RendererProps>> = {
  MetricCard: MetricCardRenderer, LineChart: LineChartRenderer,
  TimeseriesChart: LineChartRenderer, AreaChart: LineChartRenderer,
  BarChart: BarChartRenderer, PieChart: PieChartRenderer,
  DonutChart: DonutChartRenderer, DataTable: DataTableRenderer,
  InsightCard: InsightCardRenderer as any, StatusFeed: StatusFeedRenderer as any,
  HeroSection: HeroSectionRenderer as any, SocialProofBar: MetricCardRenderer,
  FeatureGrid: FeatureGridRenderer as any, PricingCards: PricingCardsRenderer as any,
  CTASection: CTASectionRenderer as any, BrandVisual: HeroSectionRenderer as any,
  PageHeader: PageHeaderRenderer as any, FilterBar: FilterBarRenderer as any,
  CRUDTable: CRUDTableRenderer as any, Pagination: FilterBarRenderer as any,
  AuthForm: AuthFormRenderer as any,
};

function getRenderer(resolvedType: string): React.ComponentType<RendererProps> {
  return RENDERER_MAP[resolvedType] || (FallbackCardRenderer as any);
}

// ── Responsive helpers (preserved from original) ──
function getResponsiveColumns(baseColumns: number, deviceMode: DeviceMode): number {
  switch (deviceMode) { case "mobile": return 1; case "tablet": return Math.min(baseColumns, 2); case "desktop": return baseColumns; }
}
function getResponsiveGap(baseGap: number, deviceMode: DeviceMode): number {
  switch (deviceMode) { case "mobile": return Math.max(8, Math.round(baseGap * 0.5)); case "tablet": return Math.max(12, Math.round(baseGap * 0.75)); case "desktop": return baseGap; }
}
function getDeviceContainerStyle(deviceMode: DeviceMode, bgColor: string): React.CSSProperties {
  switch (deviceMode) {
    case "mobile": return { maxWidth: "375px", margin: "0 auto", border: "8px solid #1f2937", borderRadius: "24px", backgroundColor: bgColor, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" };
    case "tablet": return { maxWidth: "768px", margin: "0 auto", border: "6px solid #374151", borderRadius: "16px", backgroundColor: bgColor, boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)" };
    case "desktop": return { maxWidth: "100%", backgroundColor: bgColor };
  }
}

// ── Types ──
interface SkeletonBreakpoints {
  mobile?: { stackSections?: boolean; hideSections?: string[]; columnOverrides?: Record<string, number> };
  tablet?: { stackSections?: boolean; columnOverrides?: Record<string, number> };
  desktop?: Record<string, never>;
}
interface DashboardSpec {
  title?: string;
  components?: ComponentSpec[];
  layout?: { type?: string; columns?: number; gap?: number };
  metadata?: { layoutSkeletonId?: string; skeletonBreakpoints?: SkeletonBreakpoints; skeletonVisualHierarchy?: string; [key: string]: any };
}
interface ResponsiveDashboardRendererProps {
  spec: DashboardSpec;
  designTokens: DesignTokens;
  deviceMode: DeviceMode;
  isEditing?: boolean;
  onWidgetClick?: (widgetId: string) => void;
}

// ── Main component ──
export function ResponsiveDashboardRenderer({ spec, designTokens, deviceMode, isEditing = false, onWidgetClick }: ResponsiveDashboardRendererProps) {
  const components = spec?.components ?? [];
  const layout = spec?.layout ?? { type: "grid", columns: 12, gap: 16 };
  const baseColumns = typeof layout === "object" ? layout.columns ?? 12 : 12;
  const baseGap = Math.max(16, typeof layout === "object" ? layout.gap ?? 16 : 16);
  const columns = getResponsiveColumns(baseColumns, deviceMode);
  const gap = getResponsiveGap(baseGap, deviceMode);

  // Design tokens
  const colors = designTokens?.colors ?? {};
  const backgroundColor = colors?.background ?? "#ffffff";
  const textColor = colors?.text ?? "#111827";
  const containerStyle = getDeviceContainerStyle(deviceMode, backgroundColor);
  const fonts = designTokens?.fonts ?? {};
  const headingFont = (fonts?.heading as string)?.split(",")[0]?.trim();
  const bodyFont = (fonts?.body as string)?.split(",")[0]?.trim();
  const fontsToLoad = [...new Set([headingFont, bodyFont].filter(Boolean))];

  // Skeleton breakpoints (Wolf V2)
  const skeletonBreakpoints = spec?.metadata?.skeletonBreakpoints;
  const visualHierarchy = spec?.metadata?.skeletonVisualHierarchy;

  // Filter: hide sections on mobile per skeleton breakpoints
  const visibleComponents = useMemo(() => {
    let filtered = components.filter((comp: ComponentSpec) => !comp?.props?.hidden);
    if (deviceMode === "mobile" && skeletonBreakpoints?.mobile?.hideSections) {
      const hidden = new Set(skeletonBreakpoints.mobile.hideSections);
      filtered = filtered.filter((comp) => {
        const prefix = comp.id.split("-")[0];
        return !hidden.has(comp.id) && !hidden.has(prefix) &&
               !Array.from(hidden).some((s) => comp.id.startsWith(s) || s.includes(prefix));
      });
    }
    return filtered;
  }, [components, deviceMode, skeletonBreakpoints]);

  // Sort: prioritize dominant section on mobile
  const sortedComponents = useMemo(() => {
    if (deviceMode !== "mobile" || !visualHierarchy) return visibleComponents;
    return [...visibleComponents].sort((a, b) => {
      const aD = a.id.includes(visualHierarchy) || a.props?.dominant;
      const bD = b.id.includes(visualHierarchy) || b.props?.dominant;
      if (aD && !bD) return -1;
      if (!aD && bD) return 1;
      return 0;
    });
  }, [visibleComponents, deviceMode, visualHierarchy]);

  const fontLink = fontsToLoad.length > 0
    ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f!)}:wght@400;500;600;700`).join("&")}&display=swap`} />
    : null;

  if (sortedComponents.length === 0) {
    return (<div className="flex items-center justify-center h-64 text-gray-400" style={containerStyle}>{fontLink}<p>No components in this dashboard spec.</p></div>);
  }

  // Mobile/Tablet: Stack vertically
  if (deviceMode === "mobile" || deviceMode === "tablet") {
    return (
      <div style={{ ...containerStyle, fontFamily: bodyFont || undefined }} className="overflow-hidden">
        {fontLink}
        <div className="p-4">
          {spec?.title && <h1 className="text-xl font-bold mb-4" style={{ color: textColor, fontFamily: headingFont || undefined }}>{spec.title}</h1>}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${gap}px` }}>
            {sortedComponents.map((comp: ComponentSpec) => {
              const resolved = resolveComponentType(comp.type);
              const Renderer = getRenderer(resolved);
              return <Renderer key={comp.id} component={{ ...comp, type: resolved }} designTokens={designTokens} deviceMode={deviceMode} isEditing={isEditing} onClick={() => onWidgetClick?.(comp.id)} />;
            })}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Full grid with positioning
  return (
    <div style={{ ...containerStyle, fontFamily: bodyFont || undefined }}>
      {fontLink}
      <div className="p-6">
        {spec?.title && <h1 className="text-2xl font-bold mb-6" style={{ color: textColor, fontFamily: headingFont || undefined }}>{spec.title}</h1>}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${baseColumns}, 1fr)`, gap: `${gap}px` }}>
          {sortedComponents.map((comp: ComponentSpec) => {
            const resolved = resolveComponentType(comp.type);
            const Renderer = getRenderer(resolved);
            return (
              <div key={comp.id} style={{ gridColumn: `${(comp.layout?.col ?? 0) + 1} / span ${comp.layout?.w ?? 4}`, gridRow: `${(comp.layout?.row ?? 0) + 1} / span ${comp.layout?.h ?? 2}` }}>
                <Renderer component={{ ...comp, type: resolved }} designTokens={designTokens} deviceMode={deviceMode} isEditing={isEditing} onClick={() => onWidgetClick?.(comp.id)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
