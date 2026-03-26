import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSkeletonForPlatform, getSkeletonForPlatformMix } from '@/lib/portals/platformToSkeleton';
import { logActivity } from '@/lib/activity/logActivity';
import { checkPortalLimit } from '@/lib/plans/checkLimits';
import { generateCustomPath, validateCustomPath } from '@/lib/domains/validateCustomPath';

const VALID_SKELETONS = [
  'voice-performance',
  'multi-agent-voice',
  'workflow-operations',
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

/** Clean slug from portal name — full words, no random chars */
function generateCleanSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
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

  // ── Plan limit check ─────────────────────────────────────
  try {
    const limitCheck = await checkPortalLimit(supabase, membership.tenant_id);
    if (!limitCheck.allowed) {
      const message =
        limitCheck.reason === 'trial_expired'
          ? 'Your free trial has expired. Please subscribe to continue.'
          : limitCheck.reason === 'plan_inactive'
            ? 'Your subscription is not active. Please update your billing.'
            : `Portal limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more.`;
      return NextResponse.json(
        {
          error: message,
          code: 'LIMIT_REACHED',
          reason: limitCheck.reason,
          current: limitCheck.current,
          limit: limitCheck.limit,
          plan: limitCheck.plan,
        },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error('[POST /api/client-portals/create] Limit check failed:', err);
    // Don't block portal creation if the RPC fails — log and continue
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
      { error: 'Portal name required (min 3 chars)' },
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
  // Generate token for magic_link OR for analytics stripe_gate portals
  // (analytics portals need a token for dashboard access after payment)
  const needsToken =
    finalAccess === 'magic_link' ||
    (finalAccess === 'stripe_gate' && finalSurface === 'analytics');
  const token = needsToken ? generateShortToken(name.trim()) : null;

  let finalSlug =
    finalAccess === 'stripe_gate' && slug
      ? slug
      : finalAccess === 'stripe_gate'
        ? generateCleanSlug(name)
        : null;

  // ── Slug uniqueness check (mirrors custom_path collision logic below) ──
  if (finalSlug) {
    const { data: existingSlug } = await supabase
      .from('client_portals')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (existingSlug) {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const rand = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      finalSlug = `${finalSlug}-${rand}`.slice(0, 60);
    }
  }

  const finalStatus = status === 'draft' ? 'draft' : 'active';

  // ── Generate custom_path for clean URLs on custom domains ──
  let finalCustomPath: string | null = null;
  const rawCustomPath = body.customPath;
  if (rawCustomPath && typeof rawCustomPath === 'string') {
    // Agency provided an explicit custom_path
    const pathValidation = validateCustomPath(rawCustomPath);
    if (pathValidation.valid && pathValidation.cleaned) {
      finalCustomPath = pathValidation.cleaned;
    }
    // If invalid, silently fall back to auto-generated (don't block portal creation)
  }

  if (!finalCustomPath) {
    // Auto-generate from portal name
    const generated = generateCustomPath(name.trim());
    if (generated.length >= 3) {
      finalCustomPath = generated;
    }
  }

  // Check for custom_path uniqueness within tenant (DB index catches this too,
  // but pre-check avoids a cryptic Postgres error)
  if (finalCustomPath) {
    const { data: existing } = await supabase
      .from('client_portals')
      .select('id')
      .eq('tenant_id', membership.tenant_id)
      .eq('custom_path', finalCustomPath)
      .maybeSingle();

    if (existing) {
      // Append a short random suffix to avoid collision
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const rand = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      finalCustomPath = `${finalCustomPath}-${rand}`.slice(0, 60);
    }
  }

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
      custom_path: finalCustomPath,
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
    console.error('[POST /api/client-portals/create] Insert failed:', insertError);
    return NextResponse.json(
      { error: 'Failed to create portal' },
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
      console.error('[create] portal_entities insert failed:', oeError.message);
    }
  }
  // ── Sync to Stripe if paid portal ─────────────────────────
  if (
    offering &&
    offering.pricing_type &&
    offering.pricing_type !== 'free' &&
    offering.access_type === 'stripe_gate'
  ) {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('stripe_account_id, stripe_charges_enabled')
        .eq('id', membership.tenant_id)
        .single();

      if (tenant?.stripe_charges_enabled && tenant.stripe_account_id) {
        const { syncOfferingToStripe } = await import(
          '@/lib/stripe/syncProduct'
        );
        const stripeIds = await syncOfferingToStripe(
          {
            id: offering.id,
            tenant_id: offering.tenant_id,
            name: offering.name,
            description: offering.description,
            pricing_type: offering.pricing_type,
            price_cents: offering.price_cents,
            stripe_product_id: null,
            stripe_price_id: null,
          },
          tenant.stripe_account_id
        );

        // Save Stripe IDs back to the portal
        await supabase
          .from('client_portals')
          .update({
            stripe_product_id: stripeIds.stripe_product_id,
            stripe_price_id: stripeIds.stripe_price_id,
          })
          .eq('id', offering.id)
          .eq('tenant_id', membership.tenant_id);

        offering.stripe_product_id = stripeIds.stripe_product_id;
        offering.stripe_price_id = stripeIds.stripe_price_id;
      }
    } catch (syncErr) {
      console.error('[POST /api/client-portals/create] Stripe sync error:', syncErr);
      // Non-blocking: portal was created, Stripe sync can be retried via PATCH
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
    offeringId: offering.id,
    clientId: offering.client_id ?? null,
    message: `Created portal "${offering.name}"`,
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
    ...(finalSlug ? { productUrl: `/p/${finalSlug}` } : {}),
    ...(offering?.custom_path ? { customPath: offering.custom_path } : {}),
  });
}
