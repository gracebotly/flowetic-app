import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/secrets';

export const runtime = 'nodejs';

interface N8nExecution {
  id?: number | string;
  status?: string;
  mode?: string;
  startedAt?: string;
  stoppedAt?: string | null;
  data?: { resultData?: { error?: { message?: string } } };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: membership } = await supabase.from('memberships').select('tenant_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: 'NO_TENANT' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('source_id');
  const workflowId = searchParams.get('workflow_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 10) || 10, 20);
  if (!sourceId || !workflowId) return NextResponse.json({ ok: false, code: 'MISSING_PARAMS' }, { status: 400 });

  const { data: source } = await supabase.from('sources').select('secret_hash').eq('id', sourceId).eq('tenant_id', membership.tenant_id).maybeSingle();
  if (!source?.secret_hash) return NextResponse.json({ ok: false, code: 'SOURCE_NOT_FOUND' }, { status: 404 });

  let secret: Record<string, unknown> = {};
  try { secret = JSON.parse(decryptSecret(String(source.secret_hash))); } catch { return NextResponse.json({ ok: false, code: 'INVALID_SECRET' }, { status: 400 }); }

  const apiKey = String(secret.apiKey ?? '').trim();
  const instanceUrl = String(secret.instanceUrl ?? '').trim().replace(/\/$/, '');
  if (!apiKey || !instanceUrl) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

  let raw: unknown = {};
  try {
    const res = await fetch(`${instanceUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`, { headers: { 'X-N8N-API-KEY': apiKey } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[entity-executions/n8n] n8n API returned ${res.status}: ${text.slice(0, 200)}`);
      return NextResponse.json({ ok: false, code: 'N8N_FETCH_FAILED', error: `n8n API returned ${res.status}` }, { status: 502 });
    }
    raw = await res.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[entity-executions/n8n] Fetch failed:', message);
    return NextResponse.json({ ok: false, code: 'N8N_FETCH_ERROR', error: message }, { status: 502 });
  }
  const executionsRaw = Array.isArray((raw as { data?: unknown })?.data)
    ? (raw as { data: unknown[] }).data
    : Array.isArray(raw)
      ? raw
      : [];
  const executions = (executionsRaw as N8nExecution[]).map((e) => {
    const started = e.startedAt ? new Date(e.startedAt).getTime() : NaN;
    const stopped = e.stoppedAt ? new Date(e.stoppedAt).getTime() : NaN;
    const duration = Number.isFinite(started) && Number.isFinite(stopped) ? Math.max(0, stopped - started) : null;
    const status = e.status === 'error' || e.status === 'crashed' ? 'error' : e.stoppedAt ? 'success' : 'waiting';

    return {
      id: String(e.id ?? ''),
      status,
      duration,
      mode: String(e.mode ?? ''),
      timestamp: String(e.startedAt ?? new Date().toISOString()),
      errorMessage: e.data?.resultData?.error?.message ?? null,
    };
  });

  return NextResponse.json({ ok: true, executions });
}
