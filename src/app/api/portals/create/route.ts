import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSkeletonForPlatform } from '@/lib/portals/platformToSkeleton';

const VALID_SKELETONS = ['voice-performance', 'workflow-operations', 'roi-summary', 'combined-overview'];

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'No tenant membership' }, { status: 403 });
  }

  const body = await request.json();
  const { name, sourceId, clientId, skeletonId, expiresAt } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    return NextResponse.json({ error: 'Portal name required (min 3 chars)' }, { status: 400 });
  }

  if (!sourceId) {
    return NextResponse.json({ error: 'Source ID required' }, { status: 400 });
  }

  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id, type, name, tenant_id')
    .eq('id', sourceId)
    .eq('tenant_id', membership.tenant_id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source not found or access denied' }, { status: 404 });
  }

  const finalSkeleton = skeletonId && VALID_SKELETONS.includes(skeletonId)
    ? skeletonId
    : getSkeletonForPlatform(source.type);

  const token = crypto.randomUUID();

  const { data: portal, error: insertError } = await supabase
    .from('client_portals')
    .insert({
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      name: name.trim(),
      token,
      platform_type: source.type,
      skeleton_id: finalSkeleton,
      branding: {},
      status: 'active',
      client_id: clientId?.trim() || null,
      expires_at: expiresAt || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[POST /api/portals/create] Insert failed:', insertError);
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    portal,
    magicLink: `/client/${token}`,
  });
}
