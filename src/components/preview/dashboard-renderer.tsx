"use client";

import React from "react";

/**
 * Normalize component types from various formats to canonical PascalCase.
 * Agents may generate kebab-case, snake_case, or lowercase types.
 */
const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  // KPI/Metric variants
  'kpi-card': 'MetricCard',
  'kpi_card': 'MetricCard',
  'kpicard': 'MetricCard',
  'kpi': 'MetricCard',
  'metric-card': 'MetricCard',
  'metric_card': 'MetricCard',
  'metriccard': 'MetricCard',
  'MetricCard': 'MetricCard',

  // Line chart variants
  'line-chart': 'LineChart',
  'line_chart': 'LineChart',
  'linechart': 'LineChart',
  'LineChart': 'LineChart',
  'chart': 'LineChart',

  // Bar chart variants
  'bar-chart': 'BarChart',
  'bar_chart': 'BarChart',
  'barchart': 'BarChart',
  'BarChart': 'BarChart',

  // Pie/Donut variants
  'pie-chart': 'PieChart',
  'pie_chart': 'PieChart',
  'piechart': 'PieChart',
  'PieChart': 'PieChart',
  'donut-chart': 'DonutChart',
  'donut_chart': 'DonutChart',
  'donutchart': 'DonutChart',
  'DonutChart': 'DonutChart',

  // Sankey variants
  'sankey-chart': 'SankeyChart',
  'sankey_chart': 'SankeyChart',
  'sankeychart': 'SankeyChart',
  'SankeyChart': 'SankeyChart',
  'sankey': 'SankeyChart',

  // Funnel variants
  'funnel-chart': 'FunnelChart',
  'funnel_chart': 'FunnelChart',
  'funnelchart': 'FunnelChart',
  'FunnelChart': 'FunnelChart',
  'funnel': 'FunnelChart',

  // Table variants
  'data-table': 'DataTable',
  'data_table': 'DataTable',
  'datatable': 'DataTable',
  'DataTable': 'DataTable',
  'table': 'DataTable',

  // Metric panel variants
  'metric-panel': 'MetricPanel',
  'metric_panel': 'MetricPanel',
  'metricpanel': 'MetricPanel',
  'MetricPanel': 'MetricPanel',
  'stats-panel': 'MetricPanel',
  'stats_panel': 'MetricPanel',
};

function normalizeComponentType(rawType: string): string {
  // Try direct lookup first
  if (TYPE_NORMALIZATION_MAP[rawType]) {
    return TYPE_NORMALIZATION_MAP[rawType];
  }

  // Try lowercase lookup
  const lower = rawType.toLowerCase().replace(/[-_\s]/g, '');
  for (const [key, value] of Object.entries(TYPE_NORMALIZATION_MAP)) {
    if (key.toLowerCase().replace(/[-_\s]/g, '') === lower) {
      return value;
    }
  }

  // Return original if no match (will show placeholder)
  return rawType;
}

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
  const rawType = component.type;
  const type = normalizeComponentType(rawType);
  const { props, id } = component;
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
      {type === "MetricCard" ? (
        <MetricCardPreview props={props} primaryColor={primaryColor} />
      ) : type === "LineChart" ? (
        <ChartPreview props={props} type="line" primaryColor={primaryColor} />
      ) : type === "BarChart" ? (
        <ChartPreview props={props} type="bar" primaryColor={primaryColor} />
      ) : type === "PieChart" ? (
        <ChartPreview props={props} type="pie" primaryColor={primaryColor} />
      ) : type === "DonutChart" ? (
        <ChartPreview props={props} type="donut" primaryColor={primaryColor} />
      ) : type === "FunnelChart" ? (
        <FunnelPreview props={props} primaryColor={primaryColor} />
      ) : type === "SankeyChart" ? (
        <SankeyPreview props={props} primaryColor={primaryColor} />
      ) : type === "DataTable" ? (
        <TablePreview props={props} />
      ) : type === "MetricPanel" ? (
        <MetricPanelPreview props={props} primaryColor={primaryColor} />
      ) : (
        <div className="text-sm text-gray-500 italic">
          {type} component
        </div>
      )}
    </div>
  );
}

/** Generate realistic placeholder values based on aggregation type */
function getSmartPlaceholder(aggregation?: string): string {
  if (!aggregation) return "—";
  const agg = aggregation.toLowerCase();
  if (agg === "count") return "1,247";
  if (agg === "sum") return "84,392";
  if (agg === "avg" || agg === "average") return "42.8";
  if (agg === "rate" || agg === "ratio") return "94.2%";
  if (agg === "min") return "0.3s";
  if (agg === "max") return "12.7s";
  if (agg === "p95") return "2.4s";
  if (agg === "p99") return "8.1s";
  if (agg === "median") return "1.2s";
  return "—";
}

/** Convert raw aggregation formulas to human-readable labels */
function formatAggregationLabel(aggregation: string, valueField?: string): string {
  const field = valueField ?? "value";
  // Clean the field name: snake_case/camelCase → Title Case
  const friendlyField = field
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const aggMap: Record<string, string> = {
    count: `Total ${friendlyField}s`,
    sum: `Total ${friendlyField}`,
    avg: `Average ${friendlyField}`,
    average: `Average ${friendlyField}`,
    min: `Minimum ${friendlyField}`,
    max: `Maximum ${friendlyField}`,
    median: `Median ${friendlyField}`,
    p95: `95th Percentile ${friendlyField}`,
    p99: `99th Percentile ${friendlyField}`,
    rate: `${friendlyField} Rate`,
    ratio: `${friendlyField} Ratio`,
  };
  const aggLower = aggregation.toLowerCase();
  return aggMap[aggLower] ?? `${aggregation} of ${friendlyField}`;
}

function MetricCardPreview({ props, primaryColor }: { props: any; primaryColor: string }) {
  return (
    <div>
      <div className="text-3xl font-bold" style={{ color: primaryColor }}>
        {props?.defaultValue ?? getSmartPlaceholder(props?.aggregation)}
      </div>
      {props?.subtitle && (
        <div className="text-xs text-gray-500 mt-1">{props.subtitle}</div>
      )}
      {props?.aggregation && (
        <div className="text-xs text-gray-400 mt-1">
          {formatAggregationLabel(props.aggregation, props.valueField)}
        </div>
      )}
    </div>
  );
}

function ChartPreview({ props, type, primaryColor = "#3b82f6" }: { props: any; type: string; primaryColor?: string }) {
  // SVG placeholder chart
  return (
    <div className="h-32 flex items-end gap-1 px-2">
      {type === "donut" || type === "pie" ? (
        <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="50" cy="50" r="40" fill="none" stroke={primaryColor} strokeWidth="12"
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
              backgroundColor: i === 4 ? primaryColor : "#e5e7eb",
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

function FunnelPreview({ props, primaryColor }: { props: any; primaryColor: string }) {
  const stages = props?.stages ?? props?.data ?? [
    { label: "Stage 1", value: 100 },
    { label: "Stage 2", value: 75 },
    { label: "Stage 3", value: 45 },
    { label: "Stage 4", value: 20 },
  ];
  const maxVal = Math.max(...stages.map((s: any) => s.value || 100));

  return (
    <div className="space-y-2 p-2">
      {stages.map((stage: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-20 text-xs text-gray-600 truncate">{stage.label || stage.stage}</div>
          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${(stage.value / maxVal) * 100}%`,
                backgroundColor: primaryColor,
                opacity: 1 - (i * 0.15),
              }}
            />
          </div>
          <div className="w-12 text-xs text-right font-medium">{stage.value}</div>
        </div>
      ))}
    </div>
  );
}

function SankeyPreview({ props, primaryColor }: { props: any; primaryColor: string }) {
  const flows = props?.flows ?? props?.data ?? [
    { from: "Source A", to: "Target 1", value: 40 },
    { from: "Source A", to: "Target 2", value: 30 },
    { from: "Source B", to: "Target 1", value: 25 },
    { from: "Source B", to: "Target 3", value: 20 },
  ];
  const maxVal = Math.max(...flows.map((f: any) => f.value || 100));

  return (
    <div className="space-y-1 p-2">
      {flows.map((flow: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-16 truncate text-gray-600 text-right">{flow.from}</div>
          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${(flow.value / maxVal) * 100}%`,
                backgroundColor: flow.color || primaryColor,
                opacity: 0.7 + (i * 0.05),
              }}
            />
          </div>
          <div className="w-16 truncate text-gray-600">{flow.to}</div>
          <div className="w-8 text-right font-medium">{flow.value}</div>
        </div>
      ))}
    </div>
  );
}

function MetricPanelPreview({ props, primaryColor }: { props: any; primaryColor: string }) {
  const metrics = props?.metrics ?? [
    { label: "Total", value: "1,234", trend: "+12%" },
    { label: "Average", value: "56.7", trend: "-3%" },
    { label: "Rate", value: "89%", trend: "+5%" },
  ];

  return (
    <div className="space-y-3 p-2">
      {metrics.map((m: any, i: number) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{m.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{m.value}</span>
            {m.trend && (
              <span
                className={`text-xs font-medium ${
                  m.trend?.startsWith('+') ? 'text-green-600' :
                  m.trend?.startsWith('-') ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {m.trend}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
