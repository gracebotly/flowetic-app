import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from "@/lib/api/withApiHandler";

export const POST = withApiHandler(async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: client } = await supabase
    .from('clients')
    .select('id, hub_token')
    .eq('id', id)
    .eq('tenant_id', membership.tenant_id)
    .single();

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (client.hub_token) {
    return NextResponse.json({ ok: true, hubToken: client.hub_token });
  }

  const hubToken = crypto.randomUUID();
  await supabase
    .from('clients')
    .update({ hub_token: hubToken })
    .eq('id', id)
    .eq('tenant_id', membership.tenant_id);

  return NextResponse.json({ ok: true, hubToken });
});