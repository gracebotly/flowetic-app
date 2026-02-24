import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { ResponsiveDashboardRenderer } from "@/components/preview/ResponsiveDashboardRenderer";

export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{
    dashboardId: string;
    versionId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Aggregation helpers — one per aggregation type the spec can request
// ---------------------------------------------------------------------------

/** Count non-null values of `field` across events */
function aggCount(events: Record<string, any>[], field: string): number {
  return events.filter((e) => e[field] != null && e[field] !== "").length;
}

/** Sum numeric values of `field` across events (skips non-numeric) */
function aggSum(events: Record<string, any>[], field: string): number {
  let total = 0;
  for (const e of events) {
    const v = Number(e[field]);
    if (!isNaN(v)) total += v;
  }
  return total;
}

/** Average of numeric values of `field` (skips nulls) */
function aggAvg(events: Record<string, any>[], field: string): number {
  let total = 0;
  let count = 0;
  for (const e of events) {
    const v = Number(e[field]);
    if (e[field] != null && !isNaN(v)) {
      total += v;
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

/** Percentage of events where `field` equals `matchValue` */
function aggPercentage(
  events: Record<string, any>[],
  field: string,
  matchValue: string
): number {
  const withField = events.filter((e) => e[field] != null && e[field] !== "");
  if (withField.length === 0) return 0;
  const matching = withField.filter((e) => String(e[field]) === matchValue);
  return Math.round((matching.length / withField.length) * 100);
}

/** Format a numeric value for display */
function formatMetricValue(
  value: number,
  aggregation: string,
  unit?: string
): string {
  if (aggregation === "percentage") return `${value}%`;
  if (aggregation === "avg" && unit === "seconds")
    return `${(value / 1000).toFixed(1)}s`;
  if (aggregation === "avg" && unit === "ms") return `${Math.round(value)}ms`;
  if (aggregation === "avg") return `${(value / 1000).toFixed(1)}s`; // default: assume ms → s
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(1);
}

/** Group events by a field and count occurrences → [{name, value}] */
function groupByField(
  events: Record<string, any>[],
  field: string
): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const key = e[field] != null ? String(e[field]) : null;
    if (key == null || key === "") continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

/** Build time-series data from events, aggregated into buckets */
function buildTimeSeries(
  events: Record<string, any>[],
  xField: string,
  yField: string,
  aggregation: string,
  interval: string = "hour"
): { date: string; value: number }[] {
  const buckets: Record<string, { date: string; value: number; count: number }> = {};

  for (const evt of events) {
    // Only include events that have the yField (filter noise)
    if (yField && yField !== "timestamp" && evt[yField] == null) continue;

    const ts = evt[xField] ? new Date(evt[xField]) : new Date(evt.created_at);
    let bucketKey: string;
    if (interval === "day") {
      bucketKey = ts.toISOString().slice(0, 10); // "2026-01-15"
    } else {
      bucketKey = ts.toISOString().slice(0, 13) + ":00"; // "2026-01-15T14:00"
    }

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { date: bucketKey, value: 0, count: 0 };
    }

    if (aggregation === "count") {
      buckets[bucketKey].value += 1;
      buckets[bucketKey].count += 1;
    } else if (aggregation === "sum") {
      buckets[bucketKey].value += Number(evt[yField]) || 0;
      buckets[bucketKey].count += 1;
    } else if (aggregation === "avg") {
      buckets[bucketKey].value += Number(evt[yField]) || 0;
      buckets[bucketKey].count += 1;
    } else {
      buckets[bucketKey].value += 1;
      buckets[bucketKey].count += 1;
    }
  }

  // For avg, divide totals
  if (aggregation === "avg") {
    for (const b of Object.values(buckets)) {
      if (b.count > 0) b.value = b.value / b.count;
    }
  }

  return Object.values(buckets)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      date: new Date(b.date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
      }),
      value: Math.round(b.value * 100) / 100,
    }));
}

// ---------------------------------------------------------------------------
// Type normalization map (mirrors the renderer's normalization)
// ---------------------------------------------------------------------------
const TYPE_MAP: Record<string, string> = {
  "kpi-card": "MetricCard", kpi_card: "MetricCard", kpi: "MetricCard",
  "metric-card": "MetricCard", MetricCard: "MetricCard",
  "line-chart": "LineChart", line_chart: "LineChart", LineChart: "LineChart", chart: "LineChart",
  "timeseries-chart": "LineChart", timeseries_chart: "LineChart",
  TimeseriesChart: "LineChart", timeseries: "LineChart",
  "bar-chart": "BarChart", bar_chart: "BarChart", BarChart: "BarChart",
  "pie-chart": "PieChart", pie_chart: "PieChart", PieChart: "PieChart",
  "donut-chart": "DonutChart", donut_chart: "DonutChart", DonutChart: "DonutChart",
  "data-table": "DataTable", data_table: "DataTable", DataTable: "DataTable", table: "DataTable",
};

// ---------------------------------------------------------------------------
// SPEC-AWARE transform — reads valueField, aggregation, condition per component
// ---------------------------------------------------------------------------
function transformDataForComponents(
  spec: Record<string, any>,
  events: Array<Record<string, any>>
): Record<string, any> {
  if (!spec?.components || !Array.isArray(spec.components) || events.length === 0) {
    return spec;
  }

  // Pre-build generic fallbacks for components that lack spec metadata
  let fallbackEventCount = events.length;
  let fallbackTotalValue = 0;
  for (const evt of events) {
    fallbackTotalValue += Number(evt.value) || 0;
  }

  // Pre-build generic table rows
  const tableRows = events.slice(0, 50).map((evt) => ({
    id: evt.id?.slice(0, 8) ?? "—",
    type: evt.type || "—",
    name: evt.name || evt.type || "—",
    status: evt.status || "—",
    workflow_name: evt.workflow_name || "—",
    duration_ms: evt.duration_ms != null ? `${Number(evt.duration_ms).toFixed(0)}ms` : "—",
    value: evt.value ?? "—",
    timestamp: evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "—",
  }));

  // Pre-build generic name-based categories (fallback for charts without field prop)
  const nameCounts: Record<string, number> = {};
  for (const evt of events) {
    const name = evt.name || evt.type || "unknown";
    nameCounts[name] = (nameCounts[name] || 0) + 1;
  }
  const fallbackCategoryData = Object.entries(nameCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const enrichedComponents = spec.components.map((comp: any) => {
    const normalized = TYPE_MAP[comp.type] || comp.type;
    const props = { ...(comp.props || {}) };

    switch (normalized) {
      case "MetricCard": {
        // Skip if value is already a real computed number (not a placeholder)
        if (
          props.value != null &&
          props.value !== "—" &&
          props.value !== "" &&
          !String(props.value).startsWith("{{")
        ) {
          break;
        }

        const vf = props.valueField;
        const agg = props.aggregation || "count";
        const condition = props.condition;
        const unit = props.unit;

        if (vf) {
          let computed: number;
          switch (agg) {
            case "count":
              computed = aggCount(events, vf);
              break;
            case "sum":
              computed = aggSum(events, vf);
              break;
            case "avg":
              computed = aggAvg(events, vf);
              break;
            case "percentage":
              computed = aggPercentage(
                events,
                vf,
                condition?.equals || "success"
              );
              break;
            default:
              computed = aggCount(events, vf);
          }
          props.value = formatMetricValue(computed, agg, unit);
          props.subtitle =
            props.subtitle || `from ${aggCount(events, vf)} events`;
        } else {
          // No valueField — use generic fallback
          props.value =
            fallbackTotalValue > 0
              ? fallbackTotalValue.toLocaleString()
              : String(fallbackEventCount);
          props.subtitle = props.subtitle || `${fallbackEventCount} events`;
        }
        break;
      }

      case "LineChart":
      case "TimeseriesChart": {
        if (props.data && props.data.length > 0) break;

        const xField = props.xField || "timestamp";
        const yField = props.yField || "value";
        const agg = props.aggregation || "count";
        const interval = props.interval || "hour";

        const tsData = buildTimeSeries(events, xField, yField, agg, interval);
        props.data = tsData.length > 0 ? tsData : undefined;
        break;
      }

      case "BarChart": {
        if (props.data && props.data.length > 0) break;

        const field = props.field;
        if (field) {
          const grouped = groupByField(events, field);
          props.data = grouped.length > 0 ? grouped : undefined;
        } else {
          props.data =
            fallbackCategoryData.length > 0
              ? fallbackCategoryData
              : undefined;
        }
        break;
      }

      case "PieChart":
      case "DonutChart": {
        if (props.data && props.data.length > 0) break;

        const field = props.field;
        if (field) {
          const grouped = groupByField(events, field);
          props.data = grouped.length > 0 ? grouped.slice(0, 6) : undefined;
        } else {
          props.data =
            fallbackCategoryData.length > 0
              ? fallbackCategoryData.slice(0, 5)
              : undefined;
        }
        break;
      }

      case "DataTable": {
        if (props.data && props.data.length > 0) break;

        // If the spec declares columns, use them to extract the right fields
        if (props.columns && Array.isArray(props.columns) && props.columns.length > 0) {
          const colKeys = props.columns.map((c: any) =>
            typeof c === "string" ? c : c.key
          );
          props.data = events.slice(0, 50).map((evt) => {
            const row: Record<string, any> = {};
            for (const key of colKeys) {
              if (key === "timestamp" && evt.timestamp) {
                row[key] = new Date(evt.timestamp).toLocaleString();
              } else if (key === "id" && evt.id) {
                row[key] = evt.id.slice(0, 8);
              } else if (key === "duration_ms" && evt.duration_ms != null) {
                row[key] = `${Number(evt.duration_ms).toFixed(0)}ms`;
              } else {
                row[key] = evt[key] ?? "—";
              }
            }
            return row;
          });
        } else {
          // Fallback: use pre-built table rows and auto-generate columns
          props.data = tableRows.length > 0 ? tableRows : undefined;
          if (tableRows.length > 0) {
            props.columns = Object.keys(tableRows[0]).map((k) => ({
              key: k,
              label: k
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase()),
            }));
          }
        }
        break;
      }
    }

    return { ...comp, props };
  });

  return { ...spec, components: enrichedComponents };
}

// ---------------------------------------------------------------------------
// Server Component — fetches spec + events, transforms, renders
// ---------------------------------------------------------------------------
export default async function PreviewPage({ params }: PreviewPageProps) {
  const { dashboardId, versionId } = await params;

  // Use authenticated client first (for spec — this respects RLS normally)
  const supabase = await createClient();

  // 1. Fetch the spec + design tokens
  //    Try authenticated first; fall back to service client for public previews
  let version: any = null;
  {
    const { data, error } = await supabase
      .from("interface_versions")
      .select("id, interface_id, spec_json, design_tokens")
      .eq("id", versionId)
      .eq("interface_id", dashboardId)
      .single();

    if (error || !data) {
      // Unauthenticated visitor — try service client
      try {
        const svc = createServiceClient();
        const { data: svcData, error: svcError } = await svc
          .from("interface_versions")
          .select("id, interface_id, spec_json, design_tokens")
          .eq("id", versionId)
          .eq("interface_id", dashboardId)
          .single();
        if (svcError || !svcData) notFound();
        version = svcData;
      } catch {
        notFound();
      }
    } else {
      version = data;
    }
  }

  if (!version) notFound();

  // 2. Fetch event data using service client (bypasses RLS for public preview)
  //    This is safe because we scope to the specific interface_id / source_id
  let resolvedEvents: any[] = [];
  try {
    const svc = createServiceClient();

    // 2a. Primary: fetch via interface_id
    // BUG 2 FIX: Exclude tool_event/state from primary query.
    // If only these non-metric event types exist for this interface_id,
    // the query returns 0 rows → source_id fallback triggers → real
    // workflow_execution events load → metrics actually render.
    const { data: events, error: eventsError } = await svc
      .from("events_flat")
      .select(
        "id, type, name, value, unit, text, state, timestamp, created_at, workflow_id, status, duration_ms, mode, workflow_name, execution_id, error_message"
      )
      .eq("interface_id", dashboardId)
      .not("type", "in", '("state","tool_event")')
      .order("timestamp", { ascending: false })
      .limit(200);

    if (eventsError?.message?.includes("events_flat")) {
      // View missing — fall back to events table + JS flattening
      const { data: fallbackEvents } = await svc
        .from("events")
        .select("id, type, name, value, unit, text, state, timestamp, created_at")
        .eq("interface_id", dashboardId)
        .not("type", "in", '("state","tool_event")')
        .order("timestamp", { ascending: false })
        .limit(200);
      // ✅ FIX (BUG 6c): ALWAYS flatten state JSONB to top-level fields.
      resolvedEvents = (fallbackEvents || []).map((evt: any) => {
        const flat: Record<string, any> = { ...evt };
        if (evt.state && typeof evt.state === 'object') {
          for (const [key, value] of Object.entries(evt.state)) {
            if (flat[key] == null || flat[key] === '') flat[key] = value;
          }
          if (flat.duration_ms != null) flat.duration_ms = Number(flat.duration_ms);
        }
        if (evt.labels && typeof evt.labels === 'object') {
          for (const [key, value] of Object.entries(evt.labels)) {
            if (flat[key] == null || flat[key] === '') flat[key] = value;
          }
        }
        return flat;
      });
    } else {
      // ✅ FIX (BUG 6c): Universal flattening for events_flat path too.
      resolvedEvents = (events || []).map((evt: any) => {
        const flat: Record<string, any> = { ...evt };
        if (evt.state && typeof evt.state === 'object') {
          for (const [key, value] of Object.entries(evt.state)) {
            if (flat[key] == null || flat[key] === '') flat[key] = value;
          }
          if (flat.duration_ms != null) flat.duration_ms = Number(flat.duration_ms);
        }
        if (evt.labels && typeof evt.labels === 'object') {
          for (const [key, value] of Object.entries(evt.labels)) {
            if (flat[key] == null || flat[key] === '') flat[key] = value;
          }
        }
        return flat;
      });
    }

    // 2b. Fallback: if no events via interface_id, try journey_sessions → source_id
    if (resolvedEvents.length === 0) {
      const { data: session } = await svc
        .from("journey_sessions")
        .select("source_id")
        .eq("preview_interface_id", dashboardId)
        .maybeSingle();

      if (session?.source_id) {
        const { data: sourceEvents, error: sourceEventsError } = await svc
          .from("events_flat")
          .select(
            "id, type, name, value, unit, text, state, timestamp, created_at, workflow_id, status, duration_ms, mode, workflow_name, execution_id, error_message"
          )
          .eq("source_id", session.source_id)
          .not("type", "in", '("state","tool_event")')
          .order("timestamp", { ascending: false })
          .limit(200);

        if (sourceEventsError?.message?.includes("events_flat")) {
          const { data: fallbackSourceEvents } = await svc
            .from("events")
            .select("id, type, name, value, unit, text, state, labels, timestamp, created_at")
            .eq("source_id", session.source_id)
            .not("type", "in", '("state","tool_event")')
            .order("timestamp", { ascending: false })
            .limit(200);
          // ✅ FIX (BUG 6c): ALWAYS flatten state JSONB to top-level fields.
          // All platforms (n8n, Make, Vapi) store important fields like status,
          // duration_ms, workflow_id inside the state JSONB column. Without
          // flattening, aggCount/aggPercentage/aggAvg can't find them and
          // MetricCards show "0" or "—".
          resolvedEvents = (fallbackSourceEvents || []).map((evt: any) => {
            const flat: Record<string, any> = { ...evt };
            if (evt.state && typeof evt.state === 'object') {
              for (const [key, value] of Object.entries(evt.state)) {
                if (flat[key] == null || flat[key] === '') flat[key] = value;
              }
              if (flat.duration_ms != null) flat.duration_ms = Number(flat.duration_ms);
            }
            if (evt.labels && typeof evt.labels === 'object') {
              for (const [key, value] of Object.entries(evt.labels)) {
                if (flat[key] == null || flat[key] === '') flat[key] = value;
              }
            }
            return flat;
          });
        } else {
          // ✅ FIX (BUG 6c): Universal flattening for events_flat path too.
          resolvedEvents = (sourceEvents || []).map((evt: any) => {
            const flat: Record<string, any> = { ...evt };
            if (evt.state && typeof evt.state === 'object') {
              for (const [key, value] of Object.entries(evt.state)) {
                if (flat[key] == null || flat[key] === '') flat[key] = value;
              }
              if (flat.duration_ms != null) flat.duration_ms = Number(flat.duration_ms);
            }
            if (evt.labels && typeof evt.labels === 'object') {
              for (const [key, value] of Object.entries(evt.labels)) {
                if (flat[key] == null || flat[key] === '') flat[key] = value;
              }
            }
            return flat;
          });
        }
      }
    }
  } catch (err) {
    // If service client fails (e.g., missing env var in dev), continue with empty events
    console.error("[PreviewPage] Service client error:", err);
  }

  // 3. Inject event data into spec components
  const enrichedSpec = transformDataForComponents(
    version.spec_json,
    resolvedEvents
  );

  // Extract font names for Google Fonts loading
  const headingFont = (version.design_tokens?.fonts?.heading as string | undefined)?.split(',')[0]?.trim();
  const bodyFont = (version.design_tokens?.fonts?.body as string | undefined)?.split(',')[0]?.trim();
  const fontsToLoad = [...new Set([headingFont, bodyFont].filter(Boolean))] as string[];

  const dashboardTitle = enrichedSpec?.metadata?.title || enrichedSpec?.title || null;
  const styleName = (version.design_tokens as any)?.style?.name || enrichedSpec?.metadata?.styleName || null;
  const headingFontForTitle = (version.design_tokens?.fonts?.heading as string | undefined)?.split(',')[0]?.trim();
  const titleTextColor = (version.design_tokens?.colors?.text as string) || '#111827';
  const subtitleColor = (version.design_tokens?.colors?.secondary as string) || '#64748B';

  return (
    <div className="min-h-screen" style={{ backgroundColor: (version.design_tokens?.colors?.background as string) || '#ffffff' }}>
      {fontsToLoad.length > 0 && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&')}&display=swap`}
        />
      )}
      {dashboardTitle && (
        <div className="px-6 pt-6 pb-2">
          <h1
            className="text-2xl font-bold"
            style={{
              fontFamily: headingFontForTitle ? `${headingFontForTitle}, sans-serif` : undefined,
              color: titleTextColor,
            }}
          >
            {dashboardTitle}
          </h1>
          {styleName && (
            <p className="text-sm mt-1" style={{ color: subtitleColor }}>
              Style: {styleName}
            </p>
          )}
        </div>
      )}
      <ResponsiveDashboardRenderer
        spec={enrichedSpec}
        designTokens={{
          colors:
            version.design_tokens?.colors ??
            version.design_tokens?.theme?.colors ?? { primary: "#3b82f6" },
          borderRadius: version.design_tokens?.radius ?? version.design_tokens?.borderRadius ?? 8,
          shadow: (() => {
            const raw = version.design_tokens?.shadow;
            if (!raw || raw === 'soft') return '0 1px 3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)';
            if (raw === 'medium') return '0 4px 6px rgba(0,0,0,0.1), 0 10px 15px rgba(0,0,0,0.05)';
            if (raw === 'hard') return '0 10px 25px rgba(0,0,0,0.15)';
            if (raw === 'none') return 'none';
            // If it looks like a CSS value already, use it
            if (typeof raw === 'string' && raw.includes('px')) return raw;
            return '0 1px 3px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)';
          })(),
          fonts: version.design_tokens?.fonts ?? undefined,
        }}
        deviceMode="desktop"
        isEditing={false}
      />
    </div>
  );
}
