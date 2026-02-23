import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/journey-sessions/phase?tenantId=...&threadId=...
 *
 * Lightweight endpoint that returns ONLY the current phase and preview URL
 * for a journey session. Used by the client to sync phase after streaming
 * completes, since autoAdvancePhase runs in server onFinish and has no
 * way to push updates back through the closed SSE stream.
 *
 * This is the authoritative source — it reads directly from the DB,
 * same as the chat route does on every request.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  const threadId = req.nextUrl.searchParams.get('threadId');

  if (!tenantId || !threadId) {
    return NextResponse.json(
      { error: 'Missing tenantId or threadId' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from('journey_sessions')
      .select('mode, preview_interface_id, preview_version_id, selected_outcome, selected_style_bundle_id, wireframe_confirmed, style_confirmed')
      .eq('thread_id', threadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: 'Session not found', phase: null },
        { status: 404 }
      );
    }

    let previewUrl: string | null = null;
    if (session.preview_interface_id && session.preview_version_id) {
      previewUrl = `/preview/${session.preview_interface_id}/${session.preview_version_id}`;
    }

    return NextResponse.json({
      phase: session.mode,
      previewUrl,
      selectedOutcome: session.selected_outcome,
      selectedStyleBundleId: session.selected_style_bundle_id,
      wireframeConfirmed: session.wireframe_confirmed,
      styleConfirmed: session.style_confirmed,
    });
  } catch (err: unknown) {
    console.error('[api/journey-sessions/phase] Error:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
