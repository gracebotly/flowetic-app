"use client";

import React, { useMemo } from "react";
import { AreaChart, BarChart, DonutChart } from '@tremor/react';
import type { DeviceMode } from "@/components/vibe/editor";

interface ComponentSpec {
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

interface DashboardSpec {
  title?: string;
  components?: ComponentSpec[];
  layout?: {
    type?: string;
    columns?: number;
    gap?: number;
  };
}

interface DesignTokens {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  borderRadius?: number;
  shadow?: string;
  fonts?: {
    heading?: string;
    body?: string;
  };
}

interface ResponsiveDashboardRendererProps {
  spec: DashboardSpec;
  designTokens: DesignTokens;
  deviceMode: DeviceMode;
  isEditing?: boolean;
  onWidgetClick?: (widgetId: string) => void;
}

// Type normalization (same as original dashboard-renderer.tsx)
const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  "kpi-card": "MetricCard",
  kpi_card: "MetricCard",
  kpi: "MetricCard",
  "metric-card": "MetricCard",
  MetricCard: "MetricCard",

  "line-chart": "LineChart",
  line_chart: "LineChart",
  LineChart: "LineChart",
  chart: "LineChart",

  "bar-chart": "BarChart",
  bar_chart: "BarChart",
  BarChart: "BarChart",

  "pie-chart": "PieChart",
  pie_chart: "PieChart",
  PieChart: "PieChart",

  "donut-chart": "DonutChart",
  donut_chart: "DonutChart",
  DonutChart: "DonutChart",

  "data-table": "DataTable",
  data_table: "DataTable",
  DataTable: "DataTable",
  table: "DataTable",
};

function normalizeComponentType(rawType: string): string {
  if (TYPE_NORMALIZATION_MAP[rawType]) {
    return TYPE_NORMALIZATION_MAP[rawType];
  }

  const lower = rawType.toLowerCase().replace(/[-_\s]/g, "");
  for (const [key, value] of Object.entries(TYPE_NORMALIZATION_MAP)) {
    if (key.toLowerCase().replace(/[-_\s]/g, "") === lower) {
      return value;
    }
  }

  return rawType;
}

// Responsive calculations
function getResponsiveColumns(baseColumns: number, deviceMode: DeviceMode): number {
  switch (deviceMode) {
    case "mobile":
      return 1;
    case "tablet":
      return Math.min(baseColumns, 2);
    case "desktop":
      return baseColumns;
  }
}

function getResponsiveGap(baseGap: number, deviceMode: DeviceMode): number {
  switch (deviceMode) {
    case "mobile":
      return Math.max(8, Math.round(baseGap * 0.5));
    case "tablet":
      return Math.max(12, Math.round(baseGap * 0.75));
    case "desktop":
      return baseGap;
  }
}

function getDeviceContainerStyle(deviceMode: DeviceMode, bgColor: string): React.CSSProperties {
  switch (deviceMode) {
    case "mobile":
      return {
        maxWidth: "375px",
        margin: "0 auto",
        border: "8px solid #1f2937",
        borderRadius: "24px",
        backgroundColor: bgColor,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      };
    case "tablet":
      return {
        maxWidth: "768px",
        margin: "0 auto",
        border: "6px solid #374151",
        borderRadius: "16px",
        backgroundColor: bgColor,
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
      };
    case "desktop":
      return {
        maxWidth: "100%",
        backgroundColor: bgColor,
      };
  }
}

// Component card preview
function ComponentCard({
  component,
  primaryColor,
  secondaryColor,
  accentColor,
  textColor,
  cardBackground,
  borderRadius,
  shadow,
  headingFont,
  bodyFont,
  isEditing,
  onClick,
}: {
  component: ComponentSpec;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  cardBackground: string;
  borderRadius: number;
  shadow: string;
  headingFont?: string;
  bodyFont?: string;
  isEditing: boolean;
  onClick?: () => void;
}) {
  const rawType = component.type;
  const type = normalizeComponentType(rawType);
  const { props, id } = component;
  const title = props?.title ?? id;

  const cardStyle: React.CSSProperties = {
    borderRadius: `${borderRadius}px`,
    boxShadow: shadow,
    backgroundColor: cardBackground,
    borderColor: `${textColor}10`,
    overflow: "hidden",
  };

  if (type === "MetricCard") {
    const value = props?.value ?? "—";
    const subtitle = props?.subtitle ?? props?.label ?? null;
    const hasRealValue = props?.value != null && props?.value !== "—";

    return (
      <div
        className={`h-full border transition-all duration-200 ${
          isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""
        }`}
        style={cardStyle}
        data-component-type={type}
        onClick={isEditing ? onClick : undefined}
        role={isEditing ? "button" : undefined}
        tabIndex={isEditing ? 0 : undefined}
        aria-label={isEditing ? `Edit ${title}` : undefined}
      >
        <div
          style={{
            height: "4px",
            background: `linear-gradient(90deg, ${primaryColor}, ${accentColor || primaryColor}dd)`,
            borderRadius: `${borderRadius}px ${borderRadius}px 0 0`,
          }}
        />

        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{
                color: `${textColor}88`,
                fontFamily: bodyFont || undefined,
                letterSpacing: "0.05em",
              }}
            >
              {title}
            </span>
            {props?.icon && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                }}
              >
                {getIconSymbol(props.icon)}
              </div>
            )}
          </div>

          <div
            className="text-3xl font-bold tracking-tight"
            style={{
              color: hasRealValue ? textColor : `${textColor}40`,
              fontFamily: headingFont || undefined,
              lineHeight: 1.2,
            }}
          >
            {value}
          </div>

          {subtitle && (
            <div
              className="text-sm mt-1.5"
              style={{
                color: `${textColor}66`,
                fontFamily: bodyFont || undefined,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "LineChart" || type === "TimeseriesChart" || type === "AreaChart") {
    const chartData = props?.data ?? [
      { date: "Jan", value: 100 },
      { date: "Feb", value: 150 },
      { date: "Mar", value: 120 },
      { date: "Apr", value: 180 },
    ];

    return (
      <div className={`h-full border transition-all duration-200 ${
          isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""
        }`} style={cardStyle} data-component-type={type} onClick={isEditing ? onClick : undefined} role={isEditing ? "button" : undefined} tabIndex={isEditing ? 0 : undefined}>
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          <div className="min-h-[200px]">
            <AreaChart className="h-full" data={chartData} index="date" categories={["value"]} colors={[primaryColor]} showLegend={false} showGridLines={false} showYAxis={false} curveType="natural" />
          </div>
        </div>
      </div>
    );
  }

  if (type === "BarChart") {
    const chartData = props?.data ?? [
      { name: "A", value: 40 },
      { name: "B", value: 65 },
      { name: "C", value: 50 },
      { name: "D", value: 80 },
    ];

    return (
      <div className={`h-full border transition-all duration-200 ${
          isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""
        }`} style={cardStyle} data-component-type={type} onClick={isEditing ? onClick : undefined} role={isEditing ? "button" : undefined} tabIndex={isEditing ? 0 : undefined}>
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          <div className="min-h-[200px]">
            <BarChart className="h-full" data={chartData} index="name" categories={["value"]} colors={[primaryColor, secondaryColor]} showLegend={false} showGridLines={false} />
          </div>
        </div>
      </div>
    );
  }

  if (type === "PieChart" || type === "DonutChart") {
    const chartData = props?.data ?? [
      { name: "Success", value: 75 },
      { name: "Failed", value: 15 },
      { name: "Pending", value: 10 },
    ];

    return (
      <div className={`h-full border transition-all duration-200 ${
          isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""
        }`} style={cardStyle} data-component-type={type} onClick={isEditing ? onClick : undefined} role={isEditing ? "button" : undefined} tabIndex={isEditing ? 0 : undefined}>
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          <div className="min-h-[200px]">
            <DonutChart className="h-full" data={chartData} category="value" index="name" colors={[primaryColor, secondaryColor, accentColor]} showLabel={true} />
          </div>
        </div>
      </div>
    );
  }

  if (type === "DataTable") {
    const columns = props?.columns ?? ["ID", "Name", "Status", "Date"];
    const columnLabels = columns.slice(0, 5).map((c: any) => typeof c === "string" ? c : c.label || c.key);
    const rows = props?.rows;
    const columnKeys = columns.slice(0, 5).map((c: any) => typeof c === "string" ? c : c.key);

    return (
      <div className={`h-full border transition-all duration-200 ${
          isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""
        }`} style={cardStyle} data-component-type={type} onClick={isEditing ? onClick : undefined} role={isEditing ? "button" : undefined} tabIndex={isEditing ? 0 : undefined}>
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          <div className="min-h-[120px] text-xs overflow-x-auto" style={{ fontFamily: bodyFont || undefined }}>
            <div className="grid gap-2 font-semibold pb-2 mb-1" style={{gridTemplateColumns: `repeat(${columnLabels.length}, 1fr)`, borderBottom: `2px solid ${primaryColor}30`, color: textColor}}>
              {columnLabels.map((col: string, i: number) => (<div key={i} className="truncate px-1">{col}</div>))}
            </div>

            {rows && rows.length > 0 ? (
              rows.slice(0, 5).map((row: Record<string, any>, rowIdx: number) => (
                <div key={rowIdx} className="grid gap-2 py-1.5 px-0" style={{gridTemplateColumns: `repeat(${columnLabels.length}, 1fr)`, backgroundColor: rowIdx % 2 === 0 ? "transparent" : `${primaryColor}05`, color: `${textColor}cc`, borderBottom: `1px solid ${textColor}08`}}>
                  {columnKeys.map((key: string, cellIdx: number) => (
                    <div key={cellIdx} className="truncate px-1">{row[key] ?? "—"}</div>
                  ))}
                </div>
              ))
            ) : (
              [1, 2, 3].map((rowIdx) => (
                <div key={rowIdx} className="grid gap-2 py-1.5" style={{gridTemplateColumns: `repeat(${columnLabels.length}, 1fr)`}}>
                  {columnLabels.map((_: any, cellIdx: number) => (
                    <div key={cellIdx} className="h-3 rounded animate-pulse" style={{ backgroundColor: `${textColor}12` }} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full border p-4 transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type={type} onClick={isEditing ? onClick : undefined}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
      </div>
      <div className="flex items-center justify-center h-full text-sm" style={{ color: `${textColor}66` }}>
        {type} component
      </div>
    </div>
  );
}

function getIconSymbol(iconName: string): string {
  const iconMap: Record<string, string> = {
    activity: "📊",
    "bar-chart": "📊",
    "pie-chart": "🍩",
    "line-chart": "📈",
    trending: "📈",
    "trending-up": "📈",
    zap: "⚡",
    clock: "⏱️",
    timer: "⏱️",
    users: "👥",
    user: "👤",
    check: "✅",
    "check-circle": "✅",
    alert: "⚠️",
    "alert-triangle": "⚠️",
    dollar: "💰",
    money: "💰",
    percent: "%",
    hash: "#",
    database: "🗄️",
    server: "🖥️",
    cpu: "⚙️",
    settings: "⚙️",
  };
  return iconMap[iconName.toLowerCase()] || "📊";
}

export function ResponsiveDashboardRenderer({
  spec,
  designTokens,
  deviceMode,
  isEditing = false,
  onWidgetClick,
}: ResponsiveDashboardRendererProps) {
  const components = spec?.components ?? [];
  const layout = spec?.layout ?? { type: "grid", columns: 12, gap: 16 };

  const baseColumns = typeof layout === "object" ? layout.columns ?? 12 : 12;
  const baseGap = Math.max(16, typeof layout === "object" ? layout.gap ?? 16 : 16);

  // Responsive values
  const columns = getResponsiveColumns(baseColumns, deviceMode);
  const gap = getResponsiveGap(baseGap, deviceMode);

  // Design tokens (must be extracted BEFORE containerStyle which uses backgroundColor)
  const colors = designTokens?.colors ?? {};
  const primaryColor = colors?.primary ?? "#3b82f6";
  const secondaryColor = colors?.secondary ?? "#64748B";
  const accentColor = colors?.accent ?? "#14B8A6";
  const backgroundColor = colors?.background ?? "#ffffff";
  const textColor = colors?.text ?? "#111827";
  // Card backgrounds: slightly lighter/darker than the page background
  const isDark = backgroundColor.toLowerCase() < "#888888";
  const cardBackground = isDark
    ? `${textColor}08`  // Very faint light overlay on dark backgrounds
    : "#ffffff";         // White cards on light backgrounds
  const containerStyle = getDeviceContainerStyle(deviceMode, backgroundColor);

  const borderRadius = designTokens?.borderRadius ?? 8;
  const rawShadow = designTokens?.shadow;
const shadow = (() => {
  if (!rawShadow || rawShadow === 'soft') return '0 1px 3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)';
  if (rawShadow === 'medium') return '0 4px 6px rgba(0,0,0,0.1), 0 10px 15px rgba(0,0,0,0.05)';
  if (rawShadow === 'hard') return '0 10px 25px rgba(0,0,0,0.15)';
  if (rawShadow === 'none') return 'none';
  if (typeof rawShadow === 'string' && rawShadow.includes('px')) return rawShadow;
  return '0 1px 3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)';
})();
  const fonts = designTokens?.fonts ?? {};
  const headingFont = fonts?.heading ?? undefined;
  const bodyFont = fonts?.body ?? undefined;

  // Extract font family names for Google Fonts loading
  const headingFontName = (fonts?.heading as string)?.split(',')[0]?.trim();
  const bodyFontName = (fonts?.body as string)?.split(',')[0]?.trim();
  const fontsToLoad = [...new Set([headingFontName, bodyFontName].filter(Boolean))];

  // Filter visible components
  const visibleComponents = useMemo(
    () => components.filter((comp: ComponentSpec) => !comp?.props?.hidden),
    [components]
  );

  if (visibleComponents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400" style={containerStyle}>
        {fontsToLoad.length > 0 && (
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&')}&display=swap`}
          />
        )}
        <p>No components in this dashboard spec.</p>
      </div>
    );
  }

  // Mobile/tablet: Stack vertically
  if (deviceMode === "mobile" || deviceMode === "tablet") {
    return (
      <div style={{ ...containerStyle, fontFamily: bodyFont || undefined }} className="overflow-hidden">
        {fontsToLoad.length > 0 && (
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&')}&display=swap`}
          />
        )}
        <div className="p-4">
          {spec?.title && (
            <h1 className="text-xl font-bold mb-4" style={{ color: textColor, fontFamily: headingFont || undefined }}>{spec.title}</h1>
          )}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: `${gap}px`,
            }}
          >
            {visibleComponents.map((comp: ComponentSpec) => (
              <ComponentCard
                key={comp.id}
                component={comp}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                accentColor={accentColor}
                textColor={textColor}
                cardBackground={cardBackground}
                borderRadius={borderRadius}
                shadow={shadow}
                headingFont={headingFont}
                bodyFont={bodyFont}
                isEditing={isEditing}
                onClick={() => onWidgetClick?.(comp.id)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Full grid with positioning
  return (
    <div style={{ ...containerStyle, fontFamily: bodyFont || undefined }}>
      {fontsToLoad.length > 0 && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&')}&display=swap`}
        />
      )}
      <div className="p-6">
        {spec?.title && (
          <h1 className="text-2xl font-bold mb-6" style={{ color: textColor, fontFamily: headingFont || undefined }}>{spec.title}</h1>
        )}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${baseColumns}, 1fr)`,
            gap: `${gap}px`,
          }}
        >
          {visibleComponents.map((comp: ComponentSpec) => (
            <div
              key={comp.id}
              style={{
                gridColumn: `${(comp.layout?.col ?? 0) + 1} / span ${comp.layout?.w ?? 4}`,
                gridRow: `${(comp.layout?.row ?? 0) + 1} / span ${comp.layout?.h ?? 2}`,
              }}
            >
              <ComponentCard
                component={comp}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                accentColor={accentColor}
                textColor={textColor}
                cardBackground={cardBackground}
                borderRadius={borderRadius}
                shadow={shadow}
                headingFont={headingFont}
                bodyFont={bodyFont}
                isEditing={isEditing}
                onClick={() => onWidgetClick?.(comp.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
