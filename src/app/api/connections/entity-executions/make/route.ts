import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/secrets';

export const runtime = 'nodejs';

interface MakeExecution {
  id?: number | string;
  type?: string;
  eventType?: string;
  status?: number;
  duration?: number;
  operations?: number;
  centicredits?: number;
  timestamp?: string;
  error?: { name?: string; message?: string };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: membership } = await supabase.from('memberships').select('tenant_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: 'NO_TENANT' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('source_id');
  const scenarioId = searchParams.get('scenario_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 10) || 10, 20);
  if (!sourceId || !scenarioId) return NextResponse.json({ ok: false, code: 'MISSING_PARAMS' }, { status: 400 });

  const { data: source } = await supabase.from('sources').select('secret_hash').eq('id', sourceId).eq('tenant_id', membership.tenant_id).maybeSingle();
  if (!source?.secret_hash) return NextResponse.json({ ok: false, code: 'SOURCE_NOT_FOUND' }, { status: 404 });

  let secret: Record<string, unknown> = {};
  try { secret = JSON.parse(decryptSecret(String(source.secret_hash))); } catch { return NextResponse.json({ ok: false, code: 'INVALID_SECRET' }, { status: 400 }); }

  const apiKey = String(secret.apiKey ?? '').trim();
  const zone = String(secret.zone ?? secret.region ?? 'us1').trim();
  const baseUrl = zone.includes('.') ? `https://${zone}` : `https://${zone}.make.com`;
  if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

  const res = await fetch(`${baseUrl}/api/v2/scenarios/${scenarioId}/executions?limit=${limit}`, { headers: { Authorization: `Token ${apiKey}` } });
  if (!res.ok) return NextResponse.json({ ok: false, code: 'MAKE_FETCH_FAILED' }, { status: 502 });

  const json = await res.json();
  const raw = Array.isArray(json?.executions) ? json.executions : [];
  const executions = (raw as MakeExecution[])
    .filter((e) => e.type === 'auto' && e.eventType === 'EXECUTION_END')
    .map((e) => ({
      id: String(e.id ?? ''),
      status: e.status === 3 ? 'error' : 'success',
      duration: Number(e.duration ?? 0),
      operations: Number(e.operations ?? 0),
      centicredits: Number(e.centicredits ?? 0),
      timestamp: String(e.timestamp ?? new Date().toISOString()),
      errorName: e.status === 3 ? (e.error?.name ?? null) : null,
      errorMessage: e.status === 3 ? (e.error?.message ?? null) : null,
    }));

  return NextResponse.json({ ok: true, executions });
}
