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

/**
 * Resolve a dot-notation field path from a flat event object.
 * Tries direct key first (e.g. event["body.topic"]), then nested traversal.
 * This handles both pre-flattened keys and nested objects.
 */
function resolveField(event: FlatEvent, fieldPath: string): any {
  if (fieldPath in event) return event[fieldPath];

  const parts = fieldPath.split('.');
  let current: any = event;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
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
    if (normalizedType === "ContentCard") {
      return enrichContentCard(component, events);
    }
    if (normalizedType === "RecordList") {
      return enrichRecordList(component, events);
    }
    if (normalizedType === "FilteredChart") {
      return enrichFilteredChart(component, events);
    }

    if (normalizedType === "UIHeader" || normalizedType === "SectionHeader") {
      return component;
    }

    return component;
  });

  return { ...spec, components: enrichedComponents };
}

function enrichMetricCard(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!props?.valueField || !props?.aggregation) return component;

  const values = events.map((e) => resolveField(e, props.valueField)).filter((v) => v != null);

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
    const raw = resolveField(e, dateField) || e.created_at;
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
                  .map((i) => Number(resolveField(i, valueField)))
                  .filter((n) => !isNaN(n))
                  .reduce((a, b) => a + b, 0) /
                  Math.max(items.filter((i) => !isNaN(Number(resolveField(i, valueField)))).length, 1)
              )
            : items
                .map((i) => Number(resolveField(i, valueField)))
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
    const val = String(resolveField(e, categoryField) || "unknown");
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
  const { props } = component;
  if (!props) return component;

  const categoryField = props.categoryField || props.xField;
  const valueField = props.valueField || props.yField || "count";

  // Try to compute real data from events
  if (categoryField && events.length > 0) {
    const grouped = new Map<string, number>();
    for (const e of events) {
      const key = String(resolveField(e, categoryField) ?? "unknown");
      if (valueField === "count") {
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      } else {
        const val = Number(resolveField(e, valueField));
        if (!isNaN(val)) {
          grouped.set(key, (grouped.get(key) ?? 0) + val);
        }
      }
    }

    if (grouped.size > 0) {
      const data = Array.from(grouped.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
      return { ...component, props: { ...props, data } };
    }
  }

  // If we couldn't compute from events, check if baked-in data looks hallucinated
  if (props.data && Array.isArray(props.data)) {
    const looksHallucinated = props.data.some((d: any) => {
      const name = String(d?.name ?? "");
      // Hallucination signals: random mixed case + numbers + spaces with no real words
      // Real labels: "success", "error", "workflow_123", "Template 1: Lead..."
      // Hallucinated: "7hr IRDrb WBA3w D3z", "Gtqf94ORx Y3yt6hy"
      const hasRandomMixedCase = /[a-z][A-Z]|[A-Z]{2,}[a-z]/.test(name) && /\d/.test(name);
      const tooManySpaces = (name.match(/\s/g) || []).length >= 2 && name.length < 25;
      const noCommonWords = !/^(success|error|failed|active|pending|complete|total|unknown|other|workflow|template|run)/i.test(name);
      return hasRandomMixedCase && tooManySpaces && noCommonWords;
    });

    if (looksHallucinated) {
      // Strip the garbage data — renderer will show empty/placeholder state
      return {
        ...component,
        props: {
          ...props,
          data: [],
          _enrichmentNote: "Original data appeared hallucinated and was stripped",
        },
      };
    }
  }

  return component;
}

function enrichDataTable(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  // Fix: treat empty columns array the same as missing — fall back to event keys.
  // The skeleton/wireframe builder sometimes generates columns: [] which is truthy
  // but produces empty rows since columnKeys would be [].
  const rawColumns = props?.columns;
  const hasColumns = Array.isArray(rawColumns) && rawColumns.length > 0;

  // Auto-detect meaningful columns from event data when none are provided.
  // Exclude internal DB fields that shouldn't be shown to users.
  const INTERNAL_FIELDS = new Set([
    'id', 'tenant_id', 'source_id', 'interface_id', 'run_id',
    'platform_event_id', 'created_at', '_enrichmentNote',
  ]);

  const columns = hasColumns
    ? rawColumns
    : Object.keys(events[0])
        .filter((key) => !INTERNAL_FIELDS.has(key))
        .slice(0, 8)
        .map((key) => ({ key, label: humanizeLabel(key) }));

  const columnKeys = columns.map((c: any) => (typeof c === "string" ? c : c.key));

  const rows = events.slice(0, 10).map((e) => {
    const row: Record<string, any> = {};
    columnKeys.forEach((key: string) => {
      const val = e[key];
      // Format timestamps to be human-readable
      if (val && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        row[key] = new Date(val).toLocaleString();
      } else {
        row[key] = val ?? "—";
      }
    });
    return row;
  });

  return {
    ...component,
    props: { ...props, columns, rows },
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

function enrichContentCard(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  const contentField = props?.contentField;
  if (!contentField) return component;

  // Read content from the first event that has the field populated
  const eventWithContent = events.find((e) => {
    const val = e[contentField];
    return val != null && String(val).trim().length > 0;
  });

  if (!eventWithContent) return component;

  const rawContent = String(eventWithContent[contentField]);

  return {
    ...component,
    props: {
      ...props,
      content: rawContent,
      _enrichmentNote: `Content read from field "${contentField}" (first non-empty event)`,
    },
  };
}

function enrichRecordList(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  // Internal fields to exclude from auto-detected columns
  const INTERNAL_FIELDS = new Set([
    'id', 'tenant_id', 'source_id', 'interface_id', 'run_id',
    'platform_event_id', 'created_at', '_enrichmentNote',
  ]);

  // Use provided columns or auto-detect from event keys
  const rawColumns = props?.columns;
  const hasColumns = Array.isArray(rawColumns) && rawColumns.length > 0;

  const columns = hasColumns
    ? rawColumns
    : Object.keys(events[0])
        .filter((key) => !INTERNAL_FIELDS.has(key))
        .slice(0, 10)
        .map((key) => ({
          key,
          label: key
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        }));

  const columnKeys: string[] = columns.map((c: any) => (typeof c === "string" ? c : c.key));

  // Build rows from events — include ALL fields (not just visible columns)
  // so the expanded detail view can show extra fields
  const maxRows = (props?.maxRows as number) ?? 15;
  const rows = events.slice(0, maxRows).map((e) => {
    const row: Record<string, any> = {};
    // First, add all non-internal fields
    for (const [key, val] of Object.entries(e)) {
      if (INTERNAL_FIELDS.has(key)) continue;
      // Format timestamps
      if (val && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        row[key] = new Date(val).toLocaleString();
      } else {
        row[key] = val ?? "—";
      }
    }
    return row;
  });

  return {
    ...component,
    props: {
      ...props,
      columns,
      rows,
      maxRows,
    },
  };
}

function enrichFilteredChart(component: ComponentSpec, events: FlatEvent[]): ComponentSpec {
  const { props } = component;
  if (!events.length) return component;

  const categoryField = props?.categoryField;
  const valueField = props?.valueField || "count";
  const filterNulls = props?.filterNulls !== false;

  if (!categoryField) return component;

  // Aggregate by category
  const counts = new Map<string, number>();
  for (const e of events) {
    const rawVal = resolveField(e, categoryField);
    const key = String(rawVal ?? "null");

    if (valueField === "count") {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else {
      const num = Number(resolveField(e, valueField));
      if (!isNaN(num)) {
        counts.set(key, (counts.get(key) ?? 0) + num);
      }
    }
  }

  // Convert to array and optionally filter nulls
  let data = Array.from(counts.entries())
    .map(([name, value]) => ({
      name: name
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  if (filterNulls) {
    data = data.filter((d) => {
      const lower = d.name.toLowerCase().trim();
      return lower !== "" && lower !== "null" && lower !== "undefined" && lower !== "unknown" && lower !== "—";
    });
  }

  // Cap at 15 categories to keep chart readable
  data = data.slice(0, 15);

  return {
    ...component,
    props: {
      ...props,
      data,
      _enrichmentNote: `Aggregated ${events.length} events by "${categoryField}"${filterNulls ? " (nulls filtered)" : ""}`,
    },
  };
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
    "ui-header": "UIHeader", UIHeader: "UIHeader",
    "section-header": "SectionHeader", SectionHeader: "SectionHeader",
    // Record-browser types (Phase 4)
    "content-card": "ContentCard", ContentCard: "ContentCard", content_card: "ContentCard",
    "record-list": "RecordList", RecordList: "RecordList", record_list: "RecordList",
    "filtered-chart": "FilteredChart", FilteredChart: "FilteredChart", filtered_chart: "FilteredChart",
  };
  return map[rawType] || rawType;
}

function formatMetricValue(value: number, fieldName?: string): string {
  // Duration — smart unit conversion
  if (fieldName?.includes("duration") || fieldName?.includes("_ms") || fieldName?.includes("elapsed") || fieldName?.includes("time_")) {
    if (value > 86400000) return `${(value / 86400000).toFixed(1)}d`;
    if (value > 3600000) return `${(value / 3600000).toFixed(1)}h`;
    if (value > 60000) return `${(value / 60000).toFixed(1)}m`;
    if (value > 1000) return `${(value / 1000).toFixed(1)}s`;
    return `${Math.round(value)}ms`;
  }
  // Money — currency
  if (fieldName?.includes("cost") || fieldName?.includes("amount") || fieldName?.includes("price") || fieldName?.includes("revenue") || fieldName?.includes("spend")) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  }
  // Rate — percentage
  if (fieldName?.includes("rate") || fieldName?.includes("ratio") || fieldName?.includes("percent") || fieldName?.includes("score")) {
    if (value <= 1) return `${(value * 100).toFixed(1)}%`;
    return `${value.toFixed(1)}%`;
  }
  // Large numbers
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (!Number.isInteger(value)) return value.toFixed(2);
  return value.toLocaleString();
}

function humanizeLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
