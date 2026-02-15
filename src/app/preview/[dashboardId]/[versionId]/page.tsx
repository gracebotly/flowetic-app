import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DashboardRenderer } from "@/components/preview/dashboard-renderer";

export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{
    dashboardId: string;
    versionId: string;
  }>;
}

/**
 * Transform raw events into component-ready data arrays.
 * Matches each component type to the data shape the renderer expects.
 */
function transformDataForComponents(
  spec: Record<string, any>,
  events: Array<Record<string, any>>
): Record<string, any> {
  if (!spec?.components || !Array.isArray(spec.components) || events.length === 0) {
    return spec;
  }

  // Build time-series buckets (hourly) for charts
  const hourlyBuckets: Record<string, { date: string; value: number; count: number }> = {};
  const nameCounts: Record<string, number> = {};
  let totalValue = 0;
  let eventCount = 0;

  for (const evt of events) {
    // Time-series bucketing
    const ts = evt.timestamp ? new Date(evt.timestamp) : new Date(evt.created_at);
    const hourKey = ts.toISOString().slice(0, 13) + ":00"; // "2026-01-15T14:00"
    if (!hourlyBuckets[hourKey]) {
      hourlyBuckets[hourKey] = { date: hourKey, value: 0, count: 0 };
    }
    hourlyBuckets[hourKey].value += Number(evt.value) || 1;
    hourlyBuckets[hourKey].count += 1;

    // Name aggregation for pie/bar charts
    const name = evt.name || evt.type || "unknown";
    nameCounts[name] = (nameCounts[name] || 0) + 1;

    // Totals for KPI cards
    totalValue += Number(evt.value) || 0;
    eventCount += 1;
  }

  const timeSeriesData = Object.values(hourlyBuckets)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      date: new Date(b.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" }),
      value: b.value,
    }));

  const categoryData = Object.entries(nameCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const tableRows = events.slice(0, 50).map((evt) => ({
    id: evt.id?.slice(0, 8) ?? "—",
    name: evt.name || evt.type || "—",
    value: evt.value ?? "—",
    timestamp: evt.timestamp
      ? new Date(evt.timestamp).toLocaleString()
      : "—",
    ...(evt.state || {}),
  }));

  // Type normalization map (mirrors the renderer's normalization)
  const TYPE_MAP: Record<string, string> = {
    "kpi-card": "MetricCard", kpi_card: "MetricCard", kpi: "MetricCard",
    "metric-card": "MetricCard", MetricCard: "MetricCard",
    "line-chart": "LineChart", line_chart: "LineChart", LineChart: "LineChart", chart: "LineChart",
    "timeseries-chart": "LineChart", timeseries_chart: "LineChart", TimeseriesChart: "LineChart", timeseries: "LineChart",
    "bar-chart": "BarChart", bar_chart: "BarChart", BarChart: "BarChart",
    "pie-chart": "PieChart", pie_chart: "PieChart", PieChart: "PieChart",
    "donut-chart": "DonutChart", donut_chart: "DonutChart", DonutChart: "DonutChart",
    "data-table": "DataTable", data_table: "DataTable", DataTable: "DataTable", table: "DataTable",
  };

  const enrichedComponents = spec.components.map((comp: any) => {
    const normalized = TYPE_MAP[comp.type] || comp.type;
    const props = { ...(comp.props || {}) };

    switch (normalized) {
      case "MetricCard":
        if (!props.value || props.value === "—") {
          props.value = totalValue > 0 ? totalValue.toLocaleString() : String(eventCount);
          props.subtitle = props.subtitle || `${eventCount} events`;
        }
        break;
      case "LineChart":
      case "TimeseriesChart":
        if (!props.data || props.data.length === 0) {
          props.data = timeSeriesData.length > 0 ? timeSeriesData : undefined;
        }
        break;
      case "BarChart":
        if (!props.data || props.data.length === 0) {
          props.data = categoryData.length > 0 ? categoryData : undefined;
        }
        break;
      case "PieChart":
      case "DonutChart":
        if (!props.data || props.data.length === 0) {
          props.data = categoryData.length > 0 ? categoryData.slice(0, 5) : undefined;
        }
        break;
      case "DataTable":
        if (!props.data || props.data.length === 0) {
          props.data = tableRows.length > 0 ? tableRows : undefined;
          if (tableRows.length > 0 && (!props.columns || props.columns.length === 0)) {
            props.columns = Object.keys(tableRows[0]).map((k) => ({
              key: k,
              label: k.charAt(0).toUpperCase() + k.slice(1),
            }));
          }
        }
        break;
    }

    return { ...comp, props };
  });

  return { ...spec, components: enrichedComponents };
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { dashboardId, versionId } = await params;
  const supabase = await createClient();

  // 1. Fetch the spec + design tokens (existing behavior)
  const { data: version, error } = await supabase
    .from("interface_versions")
    .select("id, interface_id, spec_json, design_tokens")
    .eq("id", versionId)
    .eq("interface_id", dashboardId)
    .single();

  if (error || !version) {
    notFound();
  }

  // 2. NEW: Fetch real event data for this interface
  const { data: events } = await supabase
    .from("events")
    .select("id, type, name, value, unit, text, state, timestamp, created_at")
    .eq("interface_id", dashboardId)
    .order("timestamp", { ascending: false })
    .limit(200);

  // 3. If no events found via interface_id, try via journey_sessions → source_id
  let resolvedEvents = events || [];
  if (resolvedEvents.length === 0) {
    const { data: session } = await supabase
      .from("journey_sessions")
      .select("source_id")
      .eq("preview_interface_id", dashboardId)
      .maybeSingle();

    if (session?.source_id) {
      const { data: sourceEvents } = await supabase
        .from("events")
        .select("id, type, name, value, unit, text, state, timestamp, created_at")
        .eq("source_id", session.source_id)
        .order("timestamp", { ascending: false })
        .limit(200);
      resolvedEvents = sourceEvents || [];
    }
  }

  // 4. Inject event data into spec components
  const enrichedSpec = transformDataForComponents(version.spec_json, resolvedEvents);

  return (
    <div className="min-h-screen bg-white">
      <DashboardRenderer
        spec={enrichedSpec}
        designTokens={version.design_tokens}
      />
    </div>
  );
}
