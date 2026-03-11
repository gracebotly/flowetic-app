import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSkeletonForPlatform, getSkeletonForPlatformMix } from '@/lib/portals/platformToSkeleton';
import { logActivity } from '@/lib/activity/logActivity';

const VALID_SKELETONS = [
  'voice-performance',
  'multi-agent-voice',
  'workflow-operations',
  'roi-summary',
];

const VALID_SURFACE_TYPES = ['analytics', 'runner', 'both'];
const VALID_ACCESS_TYPES = ['magic_link', 'stripe_gate'];


function generateShortToken(portalName: string): string {
  const slug = portalName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('-');
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const rand = Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return slug ? `${slug}-${rand}` : rand;
}

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
    entityIds,
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
    status,
  } = body;

  const allEntityIds: { id: string; sourceId: string }[] = Array.isArray(entityIds)
    ? entityIds
    : entityId
      ? [{ id: entityId, sourceId: sourceId ?? '' }]
      : [];

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
  let finalSkeleton: string | null = null;
  let finalPlatformType: string | null = resolvedPlatformType;

  if (skeletonId && VALID_SKELETONS.includes(skeletonId)) {
    finalSkeleton = skeletonId;
  } else if (allEntityIds.length > 1) {
    const sourceIds = [...new Set(allEntityIds.map((e) => e.sourceId))];
    const { data: sourceRecords } = await supabase
      .from('sources')
      .select('id, type')
      .in('id', sourceIds)
      .eq('tenant_id', membership.tenant_id);

    const platformTypes = (sourceRecords ?? []).map((s: { id: string; type: string }) => s.type);
    finalSkeleton = getSkeletonForPlatformMix(platformTypes, allEntityIds.length);
    finalPlatformType = null;
  } else if (resolvedPlatformType) {
    finalSkeleton = getSkeletonForPlatform(resolvedPlatformType);
  }

  // ── Generate token for magic_link, slug for stripe_gate ───
  const token =
    finalAccess === 'magic_link' ? generateShortToken(name.trim()) : null;

  const finalSlug =
    finalAccess === 'stripe_gate' && slug
      ? slug
      : finalAccess === 'stripe_gate'
        ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : null;

  const finalStatus = status === 'draft' ? 'draft' : 'active';

  // ── Insert ────────────────────────────────────────────────
  const { data: offering, error: insertError } = await supabase
    .from('client_portals')
    .insert({
      tenant_id: membership.tenant_id,
      name: name.trim(),
      surface_type: finalSurface,
      access_type: finalAccess,
      source_id: sourceId || null,
      entity_id: entityId || null,
      platform_type: finalPlatformType,
      skeleton_id: finalSkeleton,
      token,
      slug: finalSlug,
      description: description?.trim() || null,
      pricing_type: pricingType || 'free',
      price_cents: priceCents || 0,
      input_schema: inputSchema || [],
      execution_config: executionConfig || {},
      branding: {},
      status: finalStatus,
      published_at: finalStatus === 'active' ? new Date().toISOString() : null,
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

  if (allEntityIds.length > 1 && offering) {
    const entityRows = allEntityIds.map((e: { id: string; sourceId: string }) => ({
      portal_id: offering.id,
      entity_id: e.id,
      source_id: e.sourceId,
    }));

    const { error: oeError } = await supabase
      .from('portal_entities')
      .insert(entityRows);

    if (oeError) {
      console.error('[create] offering_entities insert failed:', oeError.message);
    }
  }
  // Log activity event (fire-and-forget)
  logActivity(supabase, {
    tenantId: membership.tenant_id,
    actorId: user.id,
    actorType: "user",
    category: "portal",
    action: "created",
    status: "success",
    entityType: "portal",
    entityId: offering.id,
    entityName: offering.name,
    clientId: offering.client_id ?? null,
    message: `Created offering "${offering.name}"`,
    details: {
      surface_type: offering.surface_type,
      access_type: offering.access_type,
      platform_type: offering.platform_type,
    },
  });

  return NextResponse.json({
    ok: true,
    offering,
    ...(token ? { magicLink: `/client/${token}` } : {}),
    ...(finalSlug ? { productUrl: `/products/${finalSlug}` } : {}),
  });
}
