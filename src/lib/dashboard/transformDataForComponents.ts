export interface FlatEvent {
  [key: string]: any;
}

export interface ComponentSpec {
  id: string;
  type: string;
  props?: Record<string, any>;
  layout?: Record<string, any>;
}

export interface DashboardSpec {
  title?: string;
  components?: ComponentSpec[];
  layout?: Record<string, any>;
  metadata?: Record<string, any>;
}

export function transformDataForComponents(
  spec: DashboardSpec,
  events: FlatEvent[]
): DashboardSpec {
  if (!spec?.components?.length) return spec;

  const enrichedComponents = spec.components.map((component) => {
    const { type, props } = component;
    if (!props) return component;

    const normalizedType = normalizeType(type);

    if (normalizedType === "MetricCard") {
      return enrichMetricCard(component, events);
    }
    if (["LineChart", "TimeseriesChart", "AreaChart"].includes(normalizedType)) {
      return enrichTimeseriesChart(component, events);
    }
    if (["PieChart", "DonutChart"].includes(normalizedType)) {
      return enrichCategoryChart(component, events);
    }
    if (["BarChart"].includes(normalizedType)) {
      return enrichBarChart(component, events);
    }
    if (normalizedType === "DataTable") {
      return enrichDataTable(component, events);
    }
    if (normalizedType === "InsightCard") {
      return enrichInsightCard(component, events);
    }
    if (normalizedType === "StatusFeed") {
      return enrichStatusFeed(component, events);
    }
    if (normalizedType === "CRUDTable") {
      return enrichCRUDTable(component, events);
    }

    return component;
  });

  return { ...spec, components: enrichedComponents };
}

function enrichMetricCard(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!props?.valueField || !props?.aggregation) return component;

  const values = events.map((e) => e[props.valueField]).filter((v) => v != null);

  let computedValue: string | number = "—";

  switch (props.aggregation) {
    case "count":
      computedValue = values.length;
      break;
    case "sum":
      computedValue = values.reduce((a: number, b: any) => a + Number(b), 0);
      break;
    case "avg":
    case "average": {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      computedValue =
        nums.length > 0
          ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
          : "—";
      break;
    }
    case "min": {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      computedValue = nums.length > 0 ? Math.min(...nums) : "—";
      break;
    }
    case "max": {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      computedValue = nums.length > 0 ? Math.max(...nums) : "—";
      break;
    }
    case "percentage": {
      if (values.length > 0) {
        const counts: Record<string, number> = {};
        values.forEach((v) => {
          const key = String(v);
          counts[key] = (counts[key] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
        const topValue = sorted[0][0];
        const topPct = Math.round((sorted[0][1] / values.length) * 100);
        computedValue = `${topPct}%`;
        if (!props.subtitle) {
          props.subtitle = `${topValue} (${sorted[0][1]}/${values.length})`;
        }
      }
      break;
    }
    default:
      computedValue = values.length;
  }

  if (typeof computedValue === "number") {
    if (isNaN(computedValue) || !isFinite(computedValue)) {
      computedValue = "—";
    } else {
      computedValue = formatMetricValue(computedValue, props.valueField);
    }
  }

  // Bug 6 fix: Catch any remaining edge cases where value is NaN/undefined
  if (computedValue === undefined || computedValue === null || computedValue === "NaN" || computedValue === "NaN%") {
    computedValue = "No data";
  }

  return {
    ...component,
    props: { ...props, value: computedValue },
  };
}

function enrichTimeseriesChart(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  // Bug 6 fix: Also check xAxisField/yAxisField which generateUISpec sets
  const dateField = props?.dateField || props?.xField || props?.xAxisField || "created_at";
  const rawValueField = props?.valueField || props?.yField || props?.yAxisField || "execution_id";
  const aggregation = props?.aggregation || "count";

  // Bug 6 fix: If valueField is a timestamp (common misassignment), 
  // fall back to count aggregation instead of trying to chart timestamp values
  const isTimestampValue = rawValueField.includes('_at') || rawValueField === 'timestamp' || rawValueField === 'date';
  const valueField = isTimestampValue ? 'count' : rawValueField;
  const effectiveAggregation = isTimestampValue ? 'count' : aggregation;

  const grouped: Record<string, FlatEvent[]> = {};
  events.forEach((e) => {
    const raw = e[dateField] || e.created_at;
    if (!raw) return;
    const date = new Date(raw);
    const key = `${date.getMonth() + 1}/${date.getDate()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  const data = Object.entries(grouped)
    .sort(([a], [b]) => {
      const [am, ad] = a.split("/").map(Number);
      const [bm, bd] = b.split("/").map(Number);
      return am !== bm ? am - bm : ad - bd;
    })
    .map(([date, items]) => ({
      date,
      value:
        effectiveAggregation === "count" || effectiveAggregation === "count_per_interval"
          ? items.length
          : effectiveAggregation === "avg"
            ? Math.round(
                items
                  .map((i) => Number(i[valueField]))
                  .filter((n) => !isNaN(n))
                  .reduce((a, b) => a + b, 0) /
                  Math.max(items.filter((i) => !isNaN(Number(i[valueField]))).length, 1)
              )
            : items
                .map((i) => Number(i[valueField]))
                .filter((n) => !isNaN(n))
                .reduce((a, b) => a + b, 0),
    }));

  return {
    ...component,
    props: { ...props, data: data.length > 0 ? data : undefined },
  };
}

function enrichCategoryChart(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  const categoryField = props?.categoryField || props?.field || props?.valueField || "status";

  const counts: Record<string, number> = {};
  events.forEach((e) => {
    const val = String(e[categoryField] || "unknown");
    counts[val] = (counts[val] || 0) + 1;
  });

  const data = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name: humanizeLabel(name), value }));

  return {
    ...component,
    props: { ...props, data: data.length > 0 ? data : undefined },
  };
}

function enrichBarChart(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  return enrichCategoryChart(component, events);
}

function enrichDataTable(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  const columns = props?.columns || Object.keys(events[0]).slice(0, 5);
  const columnKeys = columns.map((c: any) => (typeof c === "string" ? c : c.key));

  const rows = events.slice(0, 10).map((e) => {
    const row: Record<string, any> = {};
    columnKeys.forEach((key: string) => {
      row[key] = e[key] ?? "—";
    });
    return row;
  });

  return {
    ...component,
    props: { ...props, rows },
  };
}

function enrichInsightCard(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;
  const valueField = props?.valueField || "value";
  const values = events.map((e) => Number(e[valueField])).filter((n) => !isNaN(n));
  if (values.length === 0) return component;
  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  const halfLen = Math.ceil(values.length / 2);
  const recent = values.slice(-halfLen);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const trend = recentAvg > avg * 1.02 ? "up" : recentAvg < avg * 0.98 ? "down" : "stable";
  const trendPct = Math.abs(Math.round(((recentAvg - avg) / Math.max(avg, 1)) * 100));
  return {
    ...component,
    props: {
      ...props,
      computedValue: typeof avg === "number" ? formatMetricValue(avg, valueField) : String(avg),
      trend,
      trendDelta: `${trendPct}%`,
      narrative: `${props?.title || "Metric"} is trending ${trend} with ${events.length} data points.`,
    },
  };
}

function enrichStatusFeed(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;
  const statusField = props?.statusField || "status";
  const timeField = props?.timeField || "created_at";
  const messageField = props?.messageField || "name";
  const feedItems = events
    .sort((a, b) => new Date(b[timeField] || 0).getTime() - new Date(a[timeField] || 0).getTime())
    .slice(0, 10)
    .map((e) => ({
      status: String(e[statusField] || "unknown"),
      timestamp: e[timeField] || "",
      message: String(e[messageField] || e.id || "—"),
    }));
  return { ...component, props: { ...props, feedItems } };
}

function enrichCRUDTable(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const enriched = enrichDataTable(component, events);
  return { ...enriched, props: { ...enriched.props, showActions: true } };
}

function normalizeType(rawType: string): string {
  const map: Record<string, string> = {
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
    // Wolf V2: new component types
    "insight-card": "InsightCard", InsightCard: "InsightCard",
    "status-feed": "StatusFeed", StatusFeed: "StatusFeed",
    "crud-table": "CRUDTable", CRUDTable: "CRUDTable",
  };
  return map[rawType] || rawType;
}

function formatMetricValue(value: number, fieldName?: string): string {
  if (fieldName?.includes("duration") || fieldName?.includes("_ms")) {
    if (value > 86400000) return `${(value / 86400000).toFixed(1)}d`;
    if (value > 3600000) return `${(value / 3600000).toFixed(1)}h`;
    if (value > 60000) return `${(value / 60000).toFixed(1)}m`;
    if (value > 1000) return `${(value / 1000).toFixed(1)}s`;
    return `${Math.round(value)}ms`;
  }
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (!Number.isInteger(value)) return value.toFixed(2);
  return String(value);
}

function humanizeLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
