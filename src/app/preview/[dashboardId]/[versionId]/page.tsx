import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { ResponsiveDashboardRenderer } from "@/components/preview/ResponsiveDashboardRenderer";
import { transformDataForComponents } from "@/lib/dashboard/transformDataForComponents";
import { validateBeforeRender } from "@/lib/spec/validateBeforeRender";

export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{
    dashboardId: string;
    versionId: string;
  }>;
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

  // Phase 5: Validation gate — normalize + catalog-filter + prop-sanitize before render.
  const validationResult = validateBeforeRender(enrichedSpec);
  const safeSpec = validationResult.spec ?? enrichedSpec;

  // Extract font names for Google Fonts loading
  const headingFont = (version.design_tokens?.fonts?.heading as string | undefined)?.split(',')[0]?.trim();
  const bodyFont = (version.design_tokens?.fonts?.body as string | undefined)?.split(',')[0]?.trim();
  const fontsToLoad = [...new Set([headingFont, bodyFont].filter(Boolean))] as string[];

  const dashboardTitle = safeSpec?.metadata?.title || safeSpec?.title || null;
  const styleName = (version.design_tokens as any)?.style?.name || safeSpec?.metadata?.styleName || null;
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
        spec={safeSpec}
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
