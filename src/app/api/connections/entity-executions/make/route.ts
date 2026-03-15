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

  const makeHeaders = { Authorization: `Token ${apiKey}` };

  let raw: MakeExecution[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/v2/scenarios/${scenarioId}/logs?pg[limit]=${limit}&pg[sortDir]=desc`, { headers: makeHeaders });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[entity-executions/make] Make API returned ${res.status}: ${text.slice(0, 200)}`);
      return NextResponse.json({ ok: false, code: 'MAKE_FETCH_FAILED', error: `Make API returned ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    raw = Array.isArray(json) ? json : Array.isArray(json?.scenarioLogs) ? json.scenarioLogs : [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[entity-executions/make] Fetch failed:', message);
    return NextResponse.json({ ok: false, code: 'MAKE_FETCH_ERROR', error: message }, { status: 502 });
  }

  const executions = (raw as MakeExecution[])
    .filter((e) => (e.type === 'auto' || e.type === 'manual') && e.eventType === 'EXECUTION_END')
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

  // When logs endpoint returns zero executions (common for webhook-triggered scenarios),
  // fetch aggregate stats from the scenario list API as fallback.
  // Use teamId from scenario detail for a direct, reliable lookup.
  let aggregateStats: { totalExecutions: number; totalErrors: number; totalOperations: number; totalCenticredits: number } | null = null;
  if (executions.length === 0) {
    try {
      // Step 1: Get teamId from scenario detail
      const scenarioRes = await fetch(
        `${baseUrl}/api/v2/scenarios/${scenarioId}`,
        { headers: makeHeaders },
      );
      if (scenarioRes.ok) {
        const scenarioData = await scenarioRes.json();
        const teamId = (scenarioData.scenario ?? scenarioData)?.teamId;
        if (teamId) {
          // Step 2: Fetch scenario list by teamId to get aggregate stats
          const listRes = await fetch(
            `${baseUrl}/api/v2/scenarios?teamId=${teamId}`,
            { headers: makeHeaders },
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const match = (Array.isArray(listData?.scenarios) ? listData.scenarios : [])
              .find((sc: { id?: number | string }) => String(sc.id) === scenarioId);
            if (match && typeof match.executions === 'number' && match.executions > 0) {
              aggregateStats = {
                totalExecutions: match.executions,
                totalErrors: typeof match.errors === 'number' ? match.errors : 0,
                totalOperations: typeof match.operations === 'number' ? match.operations : 0,
                totalCenticredits: typeof match.centicredits === 'number' ? match.centicredits : 0,
              };
            }
          }
        }
      }
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({ ok: true, executions, aggregateStats });
}
