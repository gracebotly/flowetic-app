import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

// ── POST: Generate new token ────────────────────────────────
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: 'AUTH_REQUIRED' });

  const newToken = crypto.randomUUID();

  const { data: offering, error } = await supabase
    .from('offerings')
    .update({
      token: newToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, token')
    .maybeSingle();

  if (error || !offering) {
    console.error('[POST /api/offerings/[id]/token] Failed:', error);
    return json(500, { ok: false, code: 'TOKEN_GENERATE_FAILED' });
  }

  return json(200, {
    ok: true,
    token: newToken,
    magicLink: `/client/${newToken}`,
  });
}

// ── DELETE: Revoke token ────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: 'AUTH_REQUIRED' });

  const { error } = await supabase
    .from('offerings')
    .update({
      token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[DELETE /api/offerings/[id]/token] Failed:', error);
    return json(500, { ok: false, code: 'TOKEN_REVOKE_FAILED' });
  }

  return json(200, { ok: true });
}
