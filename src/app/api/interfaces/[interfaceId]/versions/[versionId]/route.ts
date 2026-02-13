// src/app/api/interfaces/[interfaceId]/versions/[versionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interfaceId: string; versionId: string }> }
) {
  const { interfaceId, versionId } = await params;
  console.log('[GET /versions] Request:', { interfaceId, versionId });

  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(interfaceId) || !uuidRegex.test(versionId)) {
    console.error('[GET /versions] Invalid UUID format:', { interfaceId, versionId });
    return NextResponse.json(
      { error: 'Invalid UUID format' },
      { status: 400 }
    );
  }

  try {
    // Use server-side Supabase client - gets session from cookies automatically
    const supabase = await createClient();

    // Debug: Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[GET /versions] Auth check:', {
      authenticated: !!user,
      userId: user?.id?.slice(0, 8) + '...'
    });

    const { data, error } = await supabase
      .from('interface_versions')
      .select('id, interface_id, spec_json, design_tokens, created_at')
      .eq('id', versionId)
      .eq('interface_id', interfaceId)
      .maybeSingle();

    if (error) {
      console.error('[GET /versions] Supabase error:', error);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    if (!data) {
      console.warn('[GET /versions] No version found:', { interfaceId, versionId });

      // Debug: Check if ANY versions exist for this interface
      const { data: debugVersions } = await supabase
        .from('interface_versions')
        .select('id, created_at')
        .eq('interface_id', interfaceId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (debugVersions && debugVersions.length > 0) {
        console.log('[GET /versions] Found other versions for interface:',
          debugVersions.map(v => v.id)
        );
      } else {
        console.log('[GET /versions] No versions found for interface at all');
      }

      return NextResponse.json(
        { error: 'Version not found', interfaceId, versionId },
        { status: 404 }
      );
    }

    console.log('[GET /versions] Success:', {
      versionId: data.id,
      componentCount: data.spec_json?.components?.length ?? 0,
    });

    return NextResponse.json({
      spec_json: data.spec_json,
      design_tokens: data.design_tokens,
    });
  } catch (err: any) {
    console.error('[GET /versions] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
