"use client";

import React from "react";

interface DashboardRendererProps {
  spec: Record<string, any>;
  designTokens: Record<string, any>;
}

export function DashboardRenderer({ spec, designTokens }: DashboardRendererProps) {
  const components = spec?.components ?? [];
  const layout = spec?.layout ?? { type: "grid", columns: 12, gap: 16 };
  const columns = typeof layout === "object" ? layout.columns ?? 12 : 12;
  const gap = typeof layout === "object" ? layout.gap ?? 16 : 16;

  // Extract theme colors from design tokens
  const colors = designTokens?.colors ?? designTokens?.theme?.colors ?? {};
  const primaryColor = colors?.primary ?? "#3b82f6";

  if (components.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        <p>No components in this dashboard spec.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Dashboard title */}
      {spec?.title && (
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{spec.title}</h1>
      )}

      {/* Grid layout */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
        }}
      >
        {components
          .filter((comp: any) => !comp?.props?.hidden)
          .map((comp: any) => (
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
              />
            </div>
          ))}
      </div>
    </div>
  );
}

function ComponentCard({
  component,
  primaryColor,
}: {
  component: any;
  primaryColor: string;
}) {
  const { type, props, id } = component;
  const title = props?.title ?? id;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm h-full">
      {/* Component type badge */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {type}
        </span>
      </div>

      {/* Placeholder content based on type */}
      {type === "MetricCard" || type === "metric_card" || type === "kpi" ? (
        <MetricCardPreview props={props} primaryColor={primaryColor} />
      ) : type === "LineChart" || type === "line_chart" || type === "chart" ? (
        <ChartPreview props={props} type="line" />
      ) : type === "BarChart" || type === "bar_chart" ? (
        <ChartPreview props={props} type="bar" />
      ) : type === "DonutChart" || type === "donut_chart" || type === "PieChart" || type === "pie_chart" ? (
        <ChartPreview props={props} type="donut" />
      ) : type === "DataTable" || type === "data_table" || type === "table" ? (
        <TablePreview props={props} />
      ) : (
        <div className="text-sm text-gray-500 italic">
          {type} component
        </div>
      )}
    </div>
  );
}

function MetricCardPreview({ props, primaryColor }: { props: any; primaryColor: string }) {
  return (
    <div>
      <div className="text-3xl font-bold" style={{ color: primaryColor }}>
        {props?.defaultValue ?? "—"}
      </div>
      {props?.subtitle && (
        <div className="text-xs text-gray-500 mt-1">{props.subtitle}</div>
      )}
      {props?.aggregation && (
        <div className="text-xs text-gray-400 mt-1">
          {props.aggregation}({props.valueField ?? "value"})
        </div>
      )}
    </div>
  );
}

function ChartPreview({ props, type }: { props: any; type: string }) {
  // SVG placeholder chart
  return (
    <div className="h-32 flex items-end gap-1 px-2">
      {type === "donut" ? (
        <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="12"
            strokeDasharray="188 252" strokeDashoffset="0"
            transform="rotate(-90 50 50)"
          />
        </svg>
      ) : (
        // Bar/line placeholder
        Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${30 + Math.random() * 70}%`,
              backgroundColor: i === 4 ? "#3b82f6" : "#e5e7eb",
            }}
          />
        ))
      )}
    </div>
  );
}

function TablePreview({ props }: { props: any }) {
  const columns = props?.columns ?? ["Column 1", "Column 2", "Column 3"];
  return (
    <div className="overflow-hidden rounded border border-gray-100">
      <div className="grid bg-gray-50 text-xs font-medium text-gray-600"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, 1fr)` }}
      >
        {columns.slice(0, 4).map((col: string, i: number) => (
          <div key={i} className="px-3 py-2 border-b border-gray-100">
            {typeof col === "string" ? col : (col as any)?.label ?? `Col ${i + 1}`}
          </div>
        ))}
      </div>
      {/* Placeholder rows */}
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="grid text-xs text-gray-400"
          style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, 1fr)` }}
        >
          {columns.slice(0, 4).map((_: any, col: number) => (
            <div key={col} className="px-3 py-2 border-b border-gray-50">
              ···
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
