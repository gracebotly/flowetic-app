import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity/logActivity';
import { getUserId } from '@/lib/activity/getUserId';

export const runtime = 'nodejs';

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  return membership?.tenant_id ?? null;
}

// ── GET /api/offerings/[id] ─────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: 'AUTH_REQUIRED' });

  const { data: offering, error } = await supabase
    .from('client_portals')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return json(404, { ok: false, code: 'OFFERING_NOT_FOUND' });
  }

  return json(200, { ok: true, offering });
}

// ── PATCH /api/offerings/[id] ───────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: 'AUTH_REQUIRED' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON' });
  }

  // Allowlist of updatable fields
  const allowedFields = [
    'name',
    'description',
    'surface_type',
    'access_type',
    'skeleton_id',
    'status',
    'client_id',
    'pricing_type',
    'price_cents',
    'slug',
    'custom_path',
    'input_schema',
    'execution_config',
    'branding',
    'expires_at',
    'max_runs_per_day',
    'max_runs_per_customer',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return json(400, { ok: false, code: 'NO_UPDATES' });
  }

  // ── Validate custom_path if being updated ──────────────────
  if ('custom_path' in updates) {
    const rawPath = updates.custom_path;
    if (rawPath === null || rawPath === '') {
      updates.custom_path = null; // Allow clearing
    } else if (typeof rawPath === 'string') {
      const { validateCustomPath } = await import('@/lib/domains/validateCustomPath');
      const pathValidation = validateCustomPath(rawPath);
      if (!pathValidation.valid) {
        return json(400, { ok: false, code: 'INVALID_CUSTOM_PATH', error: pathValidation.error });
      }
      // Check uniqueness within tenant (exclude self)
      const { data: pathConflict } = await supabase
        .from('client_portals')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('custom_path', pathValidation.cleaned!)
        .neq('id', id)
        .maybeSingle();

      if (pathConflict) {
        return json(409, { ok: false, code: 'CUSTOM_PATH_IN_USE', error: 'This URL path is already in use by another portal' });
      }
      updates.custom_path = pathValidation.cleaned;
    }
  }

  const { data: existingOffering, error: existingError } = await supabase
    .from('client_portals')
    .select('id, published_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingError || !existingOffering) {
    return json(404, { ok: false, code: 'OFFERING_NOT_FOUND' });
  }

  if (updates.status === 'active' && !existingOffering.published_at) {
    updates.published_at = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();

  const { data: offering, error } = await supabase
    .from('client_portals')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (error || !offering) {
    console.error('[PATCH /api/client-portals] Update failed:', error);
    return json(500, { ok: false, code: 'UPDATE_FAILED' });
  }


  // Log activity event
  const userId = await getUserId(supabase);
  logActivity(supabase, {
    tenantId,
    actorId: userId,
    actorType: "user",
    category: "portal",
    action: "updated",
    status: "success",
    entityType: "portal",
    entityId: id,
    entityName: offering.name as string,
    offeringId: id,
    message: `Updated portal "${offering.name}"`,
    details: { updated_fields: Object.keys(updates).filter((k) => k !== "updated_at") },
  });

  // ── Phase 5B: Sync to Stripe when publishing a paid offering ──
  if (
    updates.status === 'active' &&
    offering.pricing_type &&
    offering.pricing_type !== 'free' &&
    offering.access_type === 'stripe_gate'
  ) {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('stripe_account_id, stripe_charges_enabled')
        .eq('id', tenantId)
        .single();

      if (tenant?.stripe_charges_enabled && tenant.stripe_account_id) {
        const { syncOfferingToStripe } = await import(
          '@/lib/stripe/syncProduct'
        );
        const stripeIds = await syncOfferingToStripe(
          offering,
          tenant.stripe_account_id
        );

        // Save Stripe IDs back to the offering
        await supabase
          .from('client_portals')
          .update({
            stripe_product_id: stripeIds.stripe_product_id,
            stripe_price_id: stripeIds.stripe_price_id,
          })
          .eq('id', id)
          .eq('tenant_id', tenantId);

        // Merge Stripe IDs into the response
        offering.stripe_product_id = stripeIds.stripe_product_id;
        offering.stripe_price_id = stripeIds.stripe_price_id;
      }
    } catch (syncErr) {
      // Non-blocking: log but don't fail the update
      console.error('[PATCH /api/client-portals] Stripe sync error:', syncErr);
    }
  }

  return json(200, { ok: true, offering });
}

// ── DELETE /api/offerings/[id] ──────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: 'AUTH_REQUIRED' });

  // Soft-delete: set status to 'archived' and NULL out FK references
  // so this row doesn't block credential/connection deletion later.
  // Both client_portals_entity_id_fkey and client_portals_source_id_fkey
  // are NO ACTION — archived rows with non-null FKs block source_entities
  // and sources deletion.
  const { error } = await supabase
    .from('client_portals')
    .update({
      status: 'archived',
      entity_id: null,
      source_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[DELETE /api/client-portals] Delete failed:', error);
    return json(500, { ok: false, code: 'DELETE_FAILED' });
  }

  // Clean up portal_entities junction rows — deleted portals don't need them
  // and they block credential deletion via FK constraints on source_entities
  const { error: junctionErr } = await supabase
    .from('portal_entities')
    .delete()
    .eq('portal_id', id);

  if (junctionErr) {
    // Non-fatal — log but don't fail the delete
    console.warn('[DELETE /api/client-portals] Junction cleanup failed:', junctionErr.message);
  }

  // Log activity event
  const userId = await getUserId(supabase);
  logActivity(supabase, {
    tenantId,
    actorId: userId,
    actorType: "user",
    category: "portal",
    action: "deleted",
    status: "info",
    entityType: "portal",
    entityId: id,
    offeringId: id,
    message: `Deleted client portal`,
  });

  return json(200, { ok: true });
}
