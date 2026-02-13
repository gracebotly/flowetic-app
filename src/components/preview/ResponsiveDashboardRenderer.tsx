"use client";

import React, { useMemo } from "react";
import { Card, Metric, Text, AreaChart, BarChart, DonutChart } from '@tremor/react';
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
    background?: string;
    text?: string;
  };
  borderRadius?: number;
  shadow?: string;
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

function getDeviceContainerStyle(deviceMode: DeviceMode): React.CSSProperties {
  switch (deviceMode) {
    case "mobile":
      return {
        maxWidth: "375px",
        margin: "0 auto",
        border: "8px solid #1f2937",
        borderRadius: "24px",
        backgroundColor: "#ffffff",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      };
    case "tablet":
      return {
        maxWidth: "768px",
        margin: "0 auto",
        border: "6px solid #374151",
        borderRadius: "16px",
        backgroundColor: "#ffffff",
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
      };
    case "desktop":
      return {
        maxWidth: "100%",
        backgroundColor: "#ffffff",
      };
  }
}

// Component card preview
function ComponentCard({
  component,
  primaryColor,
  borderRadius,
  shadow,
  isEditing,
  onClick,
}: {
  component: ComponentSpec;
  primaryColor: string;
  borderRadius: number;
  shadow: string;
  isEditing: boolean;
  onClick?: () => void;
}) {
  const rawType = component.type;
  const type = normalizeComponentType(rawType);
  const { props, id } = component;
  const title = props?.title ?? id;

  return (
    <div
      className={`
        h-full bg-white border border-gray-200 p-4
        transition-all duration-200
        ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}
      `}
      style={{
        borderRadius: `${borderRadius}px`,
        boxShadow: shadow,
      }}
      onClick={isEditing ? onClick : undefined}
      role={isEditing ? "button" : undefined}
      tabIndex={isEditing ? 0 : undefined}
      aria-label={isEditing ? `Edit ${title}` : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          {type}
        </span>
      </div>

      {/* Premium content based on type */}
      <div className="flex-1 min-h-0">
        {type === "MetricCard" ? (
          <div className="text-center py-4">
            <Metric className="text-gray-900">
              {props?.value ?? "—"}
            </Metric>
            <Text className="text-gray-500">
              {props?.subtitle ?? props?.label ?? "Metric"}
            </Text>
          </div>
        ) : type === "LineChart" || type === "TimeseriesChart" ? (
          <AreaChart
            className="h-full"
            data={props?.data ?? [
              { date: "Jan", value: 100 },
              { date: "Feb", value: 150 },
              { date: "Mar", value: 120 },
              { date: "Apr", value: 180 },
            ]}
            index="date"
            categories={["value"]}
            colors={[primaryColor.replace("#", "")]}
            showLegend={false}
            showGridLines={false}
            showYAxis={false}
          />
        ) : type === "BarChart" ? (
          <BarChart
            className="h-full"
            data={props?.data ?? [
              { name: "A", value: 40 },
              { name: "B", value: 65 },
              { name: "C", value: 50 },
              { name: "D", value: 80 },
            ]}
            index="name"
            categories={["value"]}
            colors={[primaryColor.replace("#", "")]}
            showLegend={false}
            showGridLines={false}
          />
        ) : type === "PieChart" || type === "DonutChart" ? (
          <DonutChart
            className="h-full"
            data={props?.data ?? [
              { name: "Success", value: 75 },
              { name: "Failed", value: 15 },
              { name: "Pending", value: 10 },
            ]}
            category="value"
            index="name"
            colors={["emerald", "rose", "amber"]}
            showLabel={true}
          />
        ) : type === "DataTable" ? (
          <div className="text-xs text-gray-500">
            <div className="grid grid-cols-4 gap-2 font-medium border-b pb-2 mb-2">
              {(props?.columns ?? ["ID", "Name", "Status", "Date"]).slice(0, 4).map((col: string | { key: string; label: string }, i: number) => (
                <div key={i} className="truncate">
                  {typeof col === 'string' ? col : col.label}
                </div>
              ))}
            </div>
            {[1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-4 gap-2 py-1 border-b border-gray-100">
                {[1, 2, 3, 4].map((cell) => (
                  <div key={cell} className="h-3 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            {type} component
          </div>
        )}
      </div>
    </div>
  );
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
  const baseGap = typeof layout === "object" ? layout.gap ?? 16 : 16;

  // Responsive values
  const columns = getResponsiveColumns(baseColumns, deviceMode);
  const gap = getResponsiveGap(baseGap, deviceMode);
  const containerStyle = getDeviceContainerStyle(deviceMode);

  // Design tokens
  const colors = designTokens?.colors ?? {};
  const primaryColor = colors?.primary ?? "#3b82f6";
  const borderRadius = designTokens?.borderRadius ?? 8;
  const shadow = designTokens?.shadow ?? "0 2px 4px rgba(0,0,0,0.05)";

  // Filter visible components
  const visibleComponents = useMemo(
    () => components.filter((comp: ComponentSpec) => !comp?.props?.hidden),
    [components]
  );

  if (visibleComponents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400" style={containerStyle}>
        <p>No components in this dashboard spec.</p>
      </div>
    );
  }

  // Mobile/tablet: Stack vertically
  if (deviceMode === "mobile" || deviceMode === "tablet") {
    return (
      <div style={containerStyle} className="overflow-hidden">
        <div className="p-4">
          {spec?.title && (
            <h1 className="text-xl font-bold text-gray-900 mb-4">{spec.title}</h1>
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
                borderRadius={borderRadius}
                shadow={shadow}
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
    <div style={containerStyle}>
      <div className="p-6">
        {spec?.title && (
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{spec.title}</h1>
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
                borderRadius={borderRadius}
                shadow={shadow}
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
