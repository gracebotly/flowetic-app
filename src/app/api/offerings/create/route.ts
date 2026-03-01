import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSkeletonForPlatform } from '@/lib/portals/platformToSkeleton';

const VALID_SKELETONS = [
  'voice-performance',
  'workflow-operations',
  'roi-summary',
  'combined-overview',
];

const VALID_SURFACE_TYPES = ['analytics', 'runner', 'both'];
const VALID_ACCESS_TYPES = ['magic_link', 'stripe_gate'];

export async function POST(request: Request) {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
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

  // ── Parse body ────────────────────────────────────────────
  const body = await request.json();
  const {
    name,
    sourceId,
    entityId,
    surfaceType,
    accessType,
    skeletonId,
    clientId,
    description,
    pricingType,
    priceCents,
    slug,
    inputSchema,
    executionConfig,
    expiresAt,
  } = body;

  // ── Validate required fields ──────────────────────────────
  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    return NextResponse.json(
      { error: 'Offering name required (min 3 chars)' },
      { status: 400 }
    );
  }

  const finalSurface = VALID_SURFACE_TYPES.includes(surfaceType)
    ? surfaceType
    : 'analytics';

  const finalAccess = VALID_ACCESS_TYPES.includes(accessType)
    ? accessType
    : 'magic_link';

  // ── Validate source if provided ───────────────────────────
  let resolvedPlatformType: string | null = null;
  if (sourceId) {
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id, type, name, tenant_id')
      .eq('id', sourceId)
      .eq('tenant_id', membership.tenant_id)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: 'Source not found or access denied' },
        { status: 404 }
      );
    }
    resolvedPlatformType = source.type;
  }

  // ── Determine skeleton ────────────────────────────────────
  const finalSkeleton =
    skeletonId && VALID_SKELETONS.includes(skeletonId)
      ? skeletonId
      : resolvedPlatformType
        ? getSkeletonForPlatform(resolvedPlatformType)
        : null;

  // ── Generate token for magic_link, slug for stripe_gate ───
  const token =
    finalAccess === 'magic_link' ? crypto.randomUUID() : null;

  const finalSlug =
    finalAccess === 'stripe_gate' && slug
      ? slug
      : finalAccess === 'stripe_gate'
        ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : null;

  // ── Insert ────────────────────────────────────────────────
  const { data: offering, error: insertError } = await supabase
    .from('offerings')
    .insert({
      tenant_id: membership.tenant_id,
      name: name.trim(),
      surface_type: finalSurface,
      access_type: finalAccess,
      source_id: sourceId || null,
      entity_id: entityId || null,
      platform_type: resolvedPlatformType,
      skeleton_id: finalSkeleton,
      token,
      slug: finalSlug,
      description: description?.trim() || null,
      pricing_type: pricingType || 'free',
      price_cents: priceCents || 0,
      input_schema: inputSchema || [],
      execution_config: executionConfig || {},
      branding: {},
      status: 'active',
      client_id: clientId?.trim() || null,
      expires_at: expiresAt || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[POST /api/offerings/create] Insert failed:', insertError);
    return NextResponse.json(
      { error: 'Failed to create offering' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    offering,
    ...(token ? { magicLink: `/client/${token}` } : {}),
    ...(finalSlug ? { productUrl: `/products/${finalSlug}` } : {}),
  });
}
