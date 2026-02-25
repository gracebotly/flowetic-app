"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { DeviceMode } from "@/components/vibe/editor";
import { deriveMuted, deriveSurface, isColorDark, resolveComponentType, type ComponentSpec, type DesignTokens, type RendererProps } from "./componentRegistry";
import { sanitizeProps } from "@/lib/spec/propSchemas";

// Dashboard components (always loaded — 90% of renders)
import { MetricCardRenderer } from "./components/MetricCard";
import { LineChartRenderer } from "./components/LineChart";
import { BarChartRenderer } from "./components/BarChart";
import { PieChartRenderer, DonutChartRenderer } from "./components/PieChart";
import { DataTableRenderer } from "./components/DataTable";
import { EmptyStateCard } from './renderers/EmptyStateCard';

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
  EmptyStateCard,
};

function getRenderer(resolvedType: string): React.ComponentType<RendererProps> | null {
  const renderer = RENDERER_MAP[resolvedType];
  if (!renderer) {
    console.warn(`[ResponsiveDashboardRenderer] ⚠️ No renderer registered for type: "${resolvedType}"`);
    return null;
  }
  return renderer;
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

/**
 * Phase 2: Generate CSS custom properties from design tokens.
 * Applied at the container level so all child components can consume
 * them via var(--gf-primary) etc. This is the Tailwind 4 recommended
 * pattern instead of passing 12+ individual color props.
 */
function generateTokenCSS(designTokens: DesignTokens): React.CSSProperties {
  const colors = designTokens?.colors ?? {};
  const fonts = designTokens?.fonts ?? {};
  const bg = colors.background ?? '#ffffff';
  const isDark = isColorDark(bg);
  const surface = deriveSurface(bg, colors.surface);
  const muted = deriveMuted(colors.text ?? '#111827', colors.muted);

  return {
    '--gf-primary': colors.primary ?? '#3b82f6',
    '--gf-secondary': colors.secondary ?? '#64748B',
    '--gf-accent': colors.accent ?? '#14B8A6',
    '--gf-background': bg,
    '--gf-surface': surface,
    '--gf-text': colors.text ?? '#111827',
    '--gf-muted': muted,
    '--gf-border': isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    '--gf-radius': `${designTokens?.borderRadius ?? 8}px`,
    '--gf-shadow': designTokens?.shadow ?? '0 1px 3px rgba(0,0,0,0.08)',
    '--gf-font-heading': fonts?.heading ?? 'Inter, sans-serif',
    '--gf-font-body': fonts?.body ?? 'Inter, sans-serif',
    '--gf-spacing': '8px',
    '--gf-is-dark': isDark ? '1' : '0',
    colorScheme: isDark ? 'dark' : 'light',
  } as React.CSSProperties;
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
  metadata?: Record<string, any>;
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

  // Design tokens are authoritative — no auto-inversion.
  // The locked design system workflow produces the correct tokens.
  const effectiveTokens = designTokens;

  // Design tokens
  const colors = effectiveTokens?.colors ?? {};
  const backgroundColor = colors?.background ?? "#ffffff";
  const textColor = colors?.text ?? "#111827";
  const containerStyle = getDeviceContainerStyle(deviceMode, backgroundColor);
  const fonts = effectiveTokens?.fonts ?? {};
  const headingFont = (fonts?.heading as string)?.split(",")[0]?.trim();
  const bodyFont = (fonts?.body as string)?.split(",")[0]?.trim();
  const fontsToLoad = [...new Set([headingFont, bodyFont].filter(Boolean))];

  // Skeleton breakpoints (Wolf V2)
  // Primary: from spec metadata (set by generateUISpec).
  // Fallback: if metadata is missing breakpoints (null/undefined), try to resolve
  // from the skeleton registry using layoutSkeletonId. This handles specs that were
  // generated before the breakpoint serialization fix.
  let skeletonBreakpoints = spec?.metadata?.skeletonBreakpoints as SkeletonBreakpoints | undefined;
  const visualHierarchy = (spec?.metadata?.skeletonVisualHierarchy as string | undefined) ?? undefined;

  if (!skeletonBreakpoints && spec?.metadata?.layoutSkeletonId) {
    try {
      // Dynamic import avoided — use inline fallback map for known dashboard skeletons.
      // This is intentionally duplicated from skeletons.ts to avoid importing server-side
      // code into the client-side renderer. Only dashboard skeletons need breakpoints here.
      const FALLBACK_BREAKPOINTS: Record<string, SkeletonBreakpoints> = {
        'executive-overview': {
          mobile: { stackSections: true, columnOverrides: { 'breakdown-left': 12, 'breakdown-right': 12 } },
          tablet: { stackSections: false, columnOverrides: { 'breakdown-left': 6, 'breakdown-right': 6 } },
          desktop: {},
        },
        'operational-monitoring': {
          mobile: { stackSections: true, hideSections: ['event-feed'], columnOverrides: { 'status-panel': 12, 'trend-chart': 12 } },
          tablet: { stackSections: false, columnOverrides: { 'status-panel': 6, 'trend-chart': 6 } },
          desktop: {},
        },
        'analytical-breakdown': {
          mobile: { stackSections: true },
          tablet: { stackSections: false },
          desktop: {},
        },
        'table-first': {
          mobile: { stackSections: true, hideSections: ['metadata-filters'] },
          tablet: { stackSections: true },
          desktop: {},
        },
        'storyboard-insight': {
          mobile: { stackSections: true, hideSections: ['sidebar-context'] },
          tablet: { stackSections: false },
          desktop: {},
        },
      };
      const skeletonId = spec.metadata.layoutSkeletonId as string;
      skeletonBreakpoints = FALLBACK_BREAKPOINTS[skeletonId] ?? undefined;
      if (skeletonBreakpoints) {
        console.log(`[ResponsiveDashboardRenderer] Resolved breakpoints from fallback map for skeleton: ${skeletonId}`);
      }
    } catch {
      // Silently continue without breakpoints — responsive will just stack everything
    }
  }

  // Filter: hide sections on mobile per skeleton breakpoints
  const visibleComponents = useMemo(() => {
    let filtered = components.filter((comp: ComponentSpec) => !comp?.props?.hidden);
    if (deviceMode === "mobile" && skeletonBreakpoints?.mobile?.hideSections) {
      const hidden = new Set<string>(skeletonBreakpoints.mobile.hideSections as string[]);
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

  const fontUrl = fontsToLoad.length > 0
    ? `https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f!)}:wght@400;500;600;700`).join("&")}&display=swap`
    : null;

  const fontLink = fontUrl ? (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preload" as="style" href={fontUrl} />
      <link rel="stylesheet" href={fontUrl} />
    </>
  ) : null;

  if (sortedComponents.length === 0) {
    return (<div className="flex items-center justify-center h-64 text-gray-400" style={containerStyle}>{fontLink}<p>No components in this dashboard spec.</p></div>);
  }

  // Mobile/Tablet: Stack vertically + container queries + staggered animations
  if (deviceMode === "mobile" || deviceMode === "tablet") {
    return (
      <div style={{ ...containerStyle, ...generateTokenCSS(effectiveTokens), fontFamily: bodyFont || undefined }} className="overflow-hidden">
        {fontLink}
        <div className="p-4">
          {spec?.title && (
            <motion.h1
              className="text-xl font-bold mb-4"
              style={{ color: textColor, fontFamily: headingFont || undefined }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
            >
              {spec.title}
            </motion.h1>
          )}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${gap}px` }}>
            {(() => {
              // Apply fillGridGaps to fix orphaned components (e.g., col:7 w:5 with no left partner)
              // Uses baseColumns (12) not responsive columns (1 or 2) so gap detection works correctly
              const filledComponents = fillGridGaps(sortedComponents, baseColumns);
              return filledComponents.map((comp: ComponentSpec, index: number) => {
                const resolved = resolveComponentType(comp.type);
                if (!resolved) return null; // Phase 3: skip unknown component types
                const Renderer = getRenderer(resolved);
                if (!Renderer) return null; // Phase 3: skip unregistered renderers
                // Tablet: wide components (w >= 7 out of 12) span full width
                const tabletSpan = deviceMode === "tablet" && columns === 2
                  ? (comp.layout?.w ?? 4) >= 7 ? 2 : 1
                  : undefined;
                return (
                  <motion.div
                    key={comp.id}
                    className="@container relative"
                    style={tabletSpan ? { gridColumn: `span ${tabletSpan}` } : undefined}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.04,
                      ease: [0.25, 0.1, 0.25, 1.0],
                    }}
                  >
                    <>
                    <Renderer component={{ ...comp, type: resolved, props: sanitizeProps(resolved, comp.props ?? {}) }} designTokens={effectiveTokens} deviceMode={deviceMode} isEditing={isEditing} onClick={() => onWidgetClick?.(comp.id)} />
                    {isEditing && comp.meta?.reason && (
                      <div
                        className="absolute top-1 right-1 z-10"
                        title={String(comp.meta.reason || '').slice(0, 300) + (comp.meta.fieldName ? ` (field: ${String(comp.meta.fieldName).slice(0, 50)})` : '') + (comp.meta.source ? ` [${comp.meta.source}]` : '')}
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 flex items-center justify-center text-xs cursor-help hover:bg-blue-500/40 transition-colors">
                          ?
                        </div>
                      </div>
                    )}
                  </>
                  </motion.div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  }

  // ── Grid gap filler: expand components to fill empty space in their row ──
  function fillGridGaps(comps: ComponentSpec[], totalCols: number): ComponentSpec[] {
    if (comps.length === 0) return comps;

    // Group components by row
    const rowMap = new Map<number, ComponentSpec[]>();
    for (const c of comps) {
      const row = c.layout?.row ?? 0;
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push(c);
    }

    const result: ComponentSpec[] = [];

    for (const rowComps of rowMap.values()) {
      // Calculate total width used in this row
      const totalWidth = rowComps.reduce((sum, c) => sum + (c.layout?.w ?? 4), 0);
      const gap = totalCols - totalWidth;

      if (gap > 0 && rowComps.length === 1) {
        // Single component in row with empty space: expand to full width
        const comp = rowComps[0];
        result.push({
          ...comp,
          layout: { ...comp.layout, w: totalCols, col: 0 },
        });
      } else if (gap > 0 && rowComps.length > 1) {
        // Multiple components with gap: distribute extra space proportionally
        // Give extra to the widest component
        const sorted = [...rowComps].sort((a, b) => (b.layout?.w ?? 4) - (a.layout?.w ?? 4));
        const widest = sorted[0];
        let colOffset = 0;
        for (const comp of rowComps) {
          const extraW = comp === widest ? gap : 0;
          result.push({
            ...comp,
            layout: {
              ...comp.layout,
              w: (comp.layout?.w ?? 4) + extraW,
              col: colOffset,
            },
          });
          colOffset += (comp.layout?.w ?? 4) + extraW;
        }
      } else {
        result.push(...rowComps);
      }
    }

    return result;
  }

  // Desktop: Full grid with positioning + container queries + staggered animations
  return (
    <div style={{ ...containerStyle, ...generateTokenCSS(effectiveTokens), fontFamily: bodyFont || undefined }} className="overflow-hidden">
      {fontLink}
      <div className="p-6">
        {spec?.title && (
          <motion.h1
            className="text-2xl font-bold mb-6"
            style={{ color: textColor, fontFamily: headingFont || undefined }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            {spec.title}
          </motion.h1>
        )}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${baseColumns}, 1fr)`, gap: `${gap}px` }}>
          {(() => {
            const filledComponents = fillGridGaps(sortedComponents, baseColumns);
            return filledComponents.map((comp: ComponentSpec, index: number) => {
              const resolved = resolveComponentType(comp.type);
              if (!resolved) return null; // Phase 3: skip unknown component types
              const Renderer = getRenderer(resolved);
              if (!Renderer) return null; // Phase 3: skip unregistered renderers
              return (
                <motion.div
                  key={comp.id}
                  className="@container min-w-0 relative"
                  style={{
                    gridColumn: `${(comp.layout?.col ?? 0) + 1} / span ${Math.min(comp.layout?.w ?? 4, baseColumns - (comp.layout?.col ?? 0))}`,
                    gridRow: `${(comp.layout?.row ?? 0) + 1} / span ${comp.layout?.h ?? 2}`,
                    overflow: 'hidden',
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: [0.25, 0.1, 0.25, 1.0],
                  }}
                >
                  <>
                    <Renderer component={{ ...comp, type: resolved, props: sanitizeProps(resolved, comp.props ?? {}) }} designTokens={effectiveTokens} deviceMode={deviceMode} isEditing={isEditing} onClick={() => onWidgetClick?.(comp.id)} />
                    {isEditing && comp.meta?.reason && (
                      <div
                        className="absolute top-1 right-1 z-10"
                        title={String(comp.meta.reason || '').slice(0, 300) + (comp.meta.fieldName ? ` (field: ${String(comp.meta.fieldName).slice(0, 50)})` : '') + (comp.meta.source ? ` [${comp.meta.source}]` : '')}
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 flex items-center justify-center text-xs cursor-help hover:bg-blue-500/40 transition-colors">
                          ?
                        </div>
                      </div>
                    )}
                  </>
                </motion.div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
