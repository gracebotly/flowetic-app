import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/secrets';

export const runtime = 'nodejs';

function csvEscape(v: unknown) {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function redactPII(text: string) {
  return text
    .replace(/(\d{3})\d{4}(\d{3})/g, '$1****$2')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
}

async function getDecryptedSecret(source: { secret_hash: string }): Promise<Record<string, unknown>> {
  return JSON.parse(decryptSecret(String(source.secret_hash)));
}

// ─── Retell ───────────────────────────────────────────────────────────────────

async function fetchRetellCalls(apiKey: string, agentId: string, limit: number) {
  const res = await fetch('https://api.retellai.com/v2/list-calls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter_criteria: { agent_id: [agentId] },
      limit,
      sort_order: 'descending',
    }),
  });
  if (!res.ok) throw new Error(`Retell API returned ${res.status}`);
  const payload = await res.json();
  const raw = Array.isArray(payload) ? payload : Array.isArray(payload?.calls) ? payload.calls : [];
  return raw.map((call: Record<string, unknown>) => {
    const durationMs = Number(call.duration_ms ?? 0);
    const startTs = Number(call.start_timestamp ?? 0);
    const endTs = Number(call.end_timestamp ?? 0);
    const duration = durationMs
      ? Math.round(durationMs / 1000)
      : endTs && startTs
        ? Math.round((endTs - startTs) / 1000)
        : 0;
    const analysis = (call.call_analysis ?? {}) as Record<string, unknown>;
    const callCost = (call.call_cost ?? {}) as Record<string, unknown>;
    const combinedCost = typeof callCost.combined_cost === 'number' ? callCost.combined_cost : 0;
    return {
      id: String(call.call_id ?? ''),
      status: String(call.call_status ?? 'unknown'),
      duration,
      sentiment: String(analysis.user_sentiment ?? 'Unknown'),
      summary: String(analysis.call_summary ?? ''),
      transcript: String(call.transcript ?? ''),
      disconnectionReason: String(call.disconnection_reason ?? ''),
      timestamp: startTs || Date.now(),
      costTotal: combinedCost / 10000,
    };
  });
}

// ─── Vapi ─────────────────────────────────────────────────────────────────────

async function fetchVapiCalls(apiKey: string, assistantId: string, limit: number) {
  const listRes = await fetch(`https://api.vapi.ai/call?assistantId=${assistantId}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!listRes.ok) throw new Error(`Vapi list API returned ${listRes.status}`);
  const listPayload = await listRes.json();
  const listCalls = Array.isArray(listPayload) ? listPayload : [];

  const fullCalls = await Promise.all(
    listCalls.slice(0, limit).map(async (entry: { id?: string }) => {
      if (!entry.id) return null;
      const detailRes = await fetch(`https://api.vapi.ai/call/${entry.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!detailRes.ok) return null;
      return detailRes.json();
    }),
  );

  return fullCalls
    .filter((call): call is Record<string, unknown> => Boolean(call?.id))
    .map((call) => {
      const startedAt = String(call.startedAt ?? '');
      const endedAt = String(call.endedAt ?? '');
      const duration =
        startedAt && endedAt
          ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
          : 0;
      const artifact = (call.artifact ?? {}) as Record<string, unknown>;
      const analysis = (call.analysis ?? {}) as Record<string, unknown>;
      const costBreakdown = (call.costBreakdown ?? {}) as Record<string, unknown>;
      return {
        id: String(call.id ?? ''),
        status: String(call.status ?? 'unknown'),
        duration,
        sentiment: 'Unknown',
        summary: String(analysis.summary ?? ''),
        transcript: String(artifact.transcript ?? ''),
        disconnectionReason: String(call.endedReason ?? ''),
        timestamp: new Date(String(call.createdAt ?? Date.now())).getTime(),
        costTotal: Number(costBreakdown.total ?? call.cost ?? 0),
      };
    });
}

// ─── Make ─────────────────────────────────────────────────────────────────────

async function fetchMakeExecutions(apiKey: string, zone: string, scenarioId: string, limit: number) {
  const baseUrl = zone.includes('.') ? `https://${zone}` : `https://${zone}.make.com`;
  const res = await fetch(
    `${baseUrl}/api/v2/scenarios/${scenarioId}/logs?pg[limit]=${limit}&pg[sortDir]=desc`,
    { headers: { Authorization: `Token ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`Make API returned ${res.status}`);
  const json = await res.json();
  const raw = Array.isArray(json) ? json : Array.isArray(json?.scenarioLogs) ? json.scenarioLogs : [];
  return (raw as Record<string, unknown>[])
    .filter((e) => (e.type === 'auto' || e.type === 'manual') && e.eventType === 'EXECUTION_END')
    .map((e) => ({
      id: String(e.id ?? ''),
      status: e.status === 3 ? 'error' : 'success',
      duration: Number(e.duration ?? 0),
      operations: Number(e.operations ?? 0),
      centicredits: Number(e.centicredits ?? 0),
      timestamp: String(e.timestamp ?? new Date().toISOString()),
      errorName: e.status === 3 ? String((e.error as Record<string, unknown>)?.name ?? '') : '',
      errorMessage: e.status === 3 ? String((e.error as Record<string, unknown>)?.message ?? '') : '',
    }));
}

// ─── n8n ──────────────────────────────────────────────────────────────────────

async function fetchN8nExecutions(apiKey: string, instanceUrl: string, workflowId: string, limit: number) {
  const res = await fetch(
    `${instanceUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`,
    { headers: { 'X-N8N-API-KEY': apiKey } },
  );
  if (!res.ok) throw new Error(`n8n API returned ${res.status}`);
  const raw = await res.json();
  const executionsRaw = Array.isArray((raw as { data?: unknown })?.data)
    ? (raw as { data: unknown[] }).data
    : Array.isArray(raw)
      ? raw
      : [];
  return (executionsRaw as Record<string, unknown>[]).map((e) => {
    const startedAt = String(e.startedAt ?? '');
    const stoppedAt = String(e.stoppedAt ?? '');
    const started = startedAt ? new Date(startedAt).getTime() : NaN;
    const stopped = stoppedAt ? new Date(stoppedAt).getTime() : NaN;
    const duration = Number.isFinite(started) && Number.isFinite(stopped) ? Math.max(0, stopped - started) : 0;
    const status =
      e.status === 'error' || e.status === 'crashed' ? 'error' : stoppedAt ? 'success' : 'waiting';
    const resultData = ((e.data as Record<string, unknown>)?.resultData ?? {}) as Record<string, unknown>;
    const errorMsg = (resultData.error as Record<string, unknown>)?.message ?? '';
    return {
      id: String(e.id ?? ''),
      status,
      duration,
      operations: '',
      centicredits: '',
      timestamp: startedAt || new Date().toISOString(),
      errorName: status === 'error' ? 'Error' : '',
      errorMessage: String(errorMsg),
    };
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: 'NO_TENANT' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('source_id');
  const externalId = searchParams.get('external_id');
  const platform = searchParams.get('platform');
  const type = searchParams.get('type');
  const redact = searchParams.get('redact_pii') === 'true';

  if (!sourceId || !externalId || !platform || !type) {
    return NextResponse.json({ ok: false, code: 'MISSING_PARAMS' }, { status: 400 });
  }

  // Load source credentials (tenant-scoped)
  const { data: source } = await supabase
    .from('sources')
    .select('secret_hash')
    .eq('id', sourceId)
    .eq('tenant_id', membership.tenant_id)
    .maybeSingle();
  if (!source?.secret_hash) return NextResponse.json({ ok: false, code: 'SOURCE_NOT_FOUND' }, { status: 404 });

  let secret: Record<string, unknown> = {};
  try {
    secret = await getDecryptedSecret(source as { secret_hash: string });
  } catch {
    return NextResponse.json({ ok: false, code: 'INVALID_SECRET' }, { status: 400 });
  }

  const rows: string[] = ['# AGENCY INTERNAL — NOT FOR CLIENT DISTRIBUTION'];

  try {
    if (type === 'calls' && platform === 'retell') {
      const apiKey = String(secret.apiKey ?? '').trim();
      if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      const calls = await fetchRetellCalls(apiKey, externalId, 100);
      rows.push(['Date', 'Time', 'Duration (s)', 'Status', 'Sentiment', 'Summary', 'Transcript', 'Cost ($)', 'Disconnection Reason'].map(csvEscape).join(','));
      for (const call of calls) {
        const d = new Date(Number(call.timestamp));
        const summary = redact ? redactPII(String(call.summary)) : String(call.summary);
        const transcript = redact ? redactPII(String(call.transcript)) : String(call.transcript);
        const reason = redact ? redactPII(String(call.disconnectionReason)) : String(call.disconnectionReason);
        rows.push([
          d.toLocaleDateString('en-US'),
          d.toLocaleTimeString('en-US'),
          String(call.duration),
          String(call.status),
          String(call.sentiment),
          summary,
          transcript,
          String(call.costTotal),
          reason,
        ].map(csvEscape).join(','));
      }

    } else if (type === 'calls' && platform === 'vapi') {
      const apiKey = String(secret.apiKey ?? '').trim();
      if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      const calls = await fetchVapiCalls(apiKey, externalId, 100);
      rows.push(['Date', 'Time', 'Duration (s)', 'Status', 'Summary', 'Transcript', 'Cost ($)', 'Disconnection Reason'].map(csvEscape).join(','));
      for (const call of calls) {
        const d = new Date(Number(call.timestamp));
        const summary = redact ? redactPII(String(call.summary)) : String(call.summary);
        const transcript = redact ? redactPII(String(call.transcript)) : String(call.transcript);
        const reason = redact ? redactPII(String(call.disconnectionReason)) : String(call.disconnectionReason);
        rows.push([
          d.toLocaleDateString('en-US'),
          d.toLocaleTimeString('en-US'),
          String(call.duration),
          String(call.status),
          summary,
          transcript,
          String(call.costTotal),
          reason,
        ].map(csvEscape).join(','));
      }

    } else if (type === 'executions' && platform === 'make') {
      const apiKey = String(secret.apiKey ?? '').trim();
      const zone = String(secret.zone ?? secret.region ?? 'us1').trim();
      if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      const executions = await fetchMakeExecutions(apiKey, zone, externalId, 100);
      rows.push(['Execution ID', 'Timestamp', 'Status', 'Duration (ms)', 'Operations', 'Credits', 'Error Name', 'Error Message'].map(csvEscape).join(','));
      for (const e of executions) {
        rows.push([e.id, e.timestamp, e.status, String(e.duration), String(e.operations), String(e.centicredits), e.errorName, e.errorMessage].map(csvEscape).join(','));
      }

    } else if (type === 'executions' && platform === 'n8n') {
      const apiKey = String(secret.apiKey ?? '').trim();
      const instanceUrl = String(secret.instanceUrl ?? '').trim().replace(/\/$/, '');
      if (!apiKey || !instanceUrl) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      const executions = await fetchN8nExecutions(apiKey, instanceUrl, externalId, 100);
      rows.push(['Execution ID', 'Timestamp', 'Status', 'Duration (ms)', 'Error Message'].map(csvEscape).join(','));
      for (const e of executions) {
        rows.push([e.id, e.timestamp, e.status, String(e.duration), e.errorMessage].map(csvEscape).join(','));
      }

    } else {
      return NextResponse.json({ ok: false, code: 'UNSUPPORTED' }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[entity-export] Platform fetch failed (${platform}/${type}):`, message);
    return NextResponse.json({ ok: false, code: 'PLATFORM_FETCH_FAILED', error: message }, { status: 502 });
  }

  const csv = rows.join('\n');
  const filename = `${platform}_${type}_export.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
