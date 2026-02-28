import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transformDataForComponents } from '@/lib/dashboard/transformDataForComponents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: interfaceId } = await params;
  const versionId = request.nextUrl.searchParams.get('versionId');

  if (!interfaceId || !versionId) {
    return NextResponse.json({ error: 'Missing interfaceId or versionId' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get tenant_id from memberships table (matches all other API routes)
  // user_metadata.tenant_id is not reliably set in all auth flows
  const tenantId = user.user_metadata?.tenant_id
    || user.user_metadata?.tenantId;

  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    resolvedTenantId = membership?.tenant_id;
  }

  if (!resolvedTenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  }

  // 1. Fetch the spec version
  const { data: version, error: versionError } = await supabase
    .from('interface_versions')
    .select('spec_json, design_tokens')
    .eq('id', versionId)
    .eq('interface_id', interfaceId)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  let spec = version.spec_json;

  // 2. Fetch events and enrich
  if (spec?.components?.length) {
    try {
      // Try via interface_id first
      let events: any[] = [];
      const { data: interfaceEvents } = await supabase
        .from('events')
        .select('id, type, name, value, unit, text, state, labels, timestamp, created_at, source_id')
        .eq('interface_id', interfaceId)
        .not('type', 'in', '("state","tool_event")')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (interfaceEvents && interfaceEvents.length > 0) {
        events = interfaceEvents;
      } else {
        // Fallback: via source_id from journey session
        const { data: sessionData } = await supabase
          .from('journey_sessions')
          .select('source_id')
          .eq('preview_interface_id', interfaceId)
          .eq('tenant_id', resolvedTenantId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionData?.source_id) {
          const { data: sourceEvents } = await supabase
            .from('events')
            .select('id, type, name, value, unit, text, state, labels, timestamp, created_at, source_id')
            .eq('source_id', sessionData.source_id)
            .not('type', 'in', '("state","tool_event")')
            .order('timestamp', { ascending: false })
            .limit(200);
          if (sourceEvents) events = sourceEvents;
        }
      }

      if (events.length > 0) {
        // Flatten state + labels JSONB to top-level fields
        const flatEvents = events.map((evt: any) => {
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

        spec = transformDataForComponents(spec, flatEvents);

        console.log('[preview-enriched] Enriched spec with events:', {
          eventCount: flatEvents.length,
          enrichedComponents: spec.components?.length ?? 0,
        });
      } else {
        console.warn('[preview-enriched] No events found — spec will have placeholder data');
      }
    } catch (err) {
      console.warn('[preview-enriched] Event enrichment failed (non-fatal):', err);
      // Continue with un-enriched spec
    }
  }

  return NextResponse.json({
    spec_json: spec,
    design_tokens: version.design_tokens,
  });
}
