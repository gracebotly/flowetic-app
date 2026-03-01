import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    .from('offerings')
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

  updates.updated_at = new Date().toISOString();

  const { data: offering, error } = await supabase
    .from('offerings')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (error || !offering) {
    console.error('[PATCH /api/offerings] Update failed:', error);
    return json(500, { ok: false, code: 'UPDATE_FAILED' });
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

  // Soft-delete: set status to 'archived'
  const { error } = await supabase
    .from('offerings')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[DELETE /api/offerings] Archive failed:', error);
    return json(500, { ok: false, code: 'DELETE_FAILED' });
  }

  return json(200, { ok: true });
}
