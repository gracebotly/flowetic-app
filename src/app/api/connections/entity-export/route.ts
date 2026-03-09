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

// ─── Transcript formatter ─────────────────────────────────────────────────────
// Converts raw transcript lines into scannable [AI] / [YOU] labeled turns
function formatTranscript(raw: string): string {
  if (!raw) return '';
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line.startsWith('AI:')) return `[AI]  ${line.slice(3).trim()}`;
      if (line.startsWith('User:')) return `[YOU] ${line.slice(5).trim()}`;
      if (line.startsWith('Agent:')) return `[AI]  ${line.slice(6).trim()}`;
      if (line.startsWith('Human:')) return `[YOU] ${line.slice(6).trim()}`;
      return `      ${line}`;
    })
    .join(' | ');
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
      Timestamp: String(e.timestamp ?? ''),
      Status: e.status === 3 ? 'Error' : 'Success',
      'Duration (ms)': Number(e.duration ?? 0),
      Operations: Number(e.operations ?? 0),
      Credits: Number(e.centicredits ?? 0),
      'Error Name': e.status === 3 ? String((e.error as Record<string, unknown>)?.name ?? '') : '',
      'Error Message': e.status === 3 ? String((e.error as Record<string, unknown>)?.message ?? '') : '',
    }));
}

// ─── n8n ──────────────────────────────────────────────────────────────────────

async function fetchN8nExecutions(apiKey: string, instanceUrl: string, workflowId: string, limit: number) {
  const res = await fetch(
    `${instanceUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}&includeData=true`,
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
    const durationMs = Number.isFinite(started) && Number.isFinite(stopped) ? Math.max(0, stopped - started) : 0;
    const execStatus = e.status === 'error' || e.status === 'crashed' ? 'Error' : stoppedAt ? 'Success' : 'Waiting';

    const resultData = ((e.data as Record<string, unknown>)?.resultData ?? {}) as Record<string, unknown>;
    const runData = (resultData.runData ?? {}) as Record<string, unknown[]>;

    // Extract trigger node payload (first node = trigger)
    const triggerNodeKey = Object.keys(runData)[0];
    const triggerRuns = triggerNodeKey ? (runData[triggerNodeKey] as Record<string, unknown>[]) : [];
    const triggerOutput = triggerRuns?.[0];
    const items = ((triggerOutput?.data as Record<string, unknown>)?.main as unknown[][])?.[0] ?? [];
    const firstItem = (items[0] as Record<string, unknown>)?.json as Record<string, unknown> ?? {};

    // Webhook payloads nest data inside .body; fall back to the json directly
    const payload: Record<string, unknown> = (firstItem.body as Record<string, unknown>) ?? firstItem;

    // Strip internal webhook metadata (headers, params, query, webhookUrl, executionMode)
    const skipKeys = new Set(['headers', 'params', 'query', 'webhookUrl', 'executionMode']);
    const cleanPayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!skipKeys.has(k)) {
        // Flatten arrays to pipe-separated strings for CSV readability
        cleanPayload[k] = Array.isArray(v) ? (v as unknown[]).join(' | ') : v;
      }
    }

    return {
      Timestamp: startedAt,
      Status: execStatus,
      'Duration (ms)': durationMs,
      ...cleanPayload,
    };
  });
}

// ─── n8n node summary ─────────────────────────────────────────────────────────

async function fetchN8nNodeSummary(apiKey: string, instanceUrl: string, workflowId: string) {
  const res = await fetch(
    `${instanceUrl}/api/v1/workflows/${workflowId}`,
    { headers: { 'X-N8N-API-KEY': apiKey } },
  );
  if (!res.ok) throw new Error(`n8n workflow API returned ${res.status}`);
  const wf = await res.json() as Record<string, unknown>;
  const nodes = Array.isArray(wf.nodes) ? wf.nodes as Record<string, unknown>[] : [];
  const connections = (wf.connections ?? {}) as Record<string, { main?: { node: string }[][] }>;

  return nodes
    .filter((n) => n.type !== 'n8n-nodes-base.stickyNote')
    .map((n) => {
      const outgoing = connections[String(n.name)]?.main?.flat() ?? [];
      const connectsTo = outgoing.map((c) => c.node).join(' → ');
      return {
        'Node Name': String(n.name ?? ''),
        Type: String(n.type ?? '').replace('n8n-nodes-base.', '').replace('n8n-nodes-', ''),
        'Position X': String((n.position as number[])?.[0] ?? ''),
        'Position Y': String((n.position as number[])?.[1] ?? ''),
        'Connects To': connectsTo,
        'On Error': String(n.onError ?? 'stopWorkflow'),
      };
    });
}

// ─── Make node summary ────────────────────────────────────────────────────────

async function fetchMakeNodeSummary(apiKey: string, zone: string, scenarioId: string) {
  const baseUrl = zone.includes('.') ? `https://${zone}` : `https://${zone}.make.com`;
  const res = await fetch(
    `${baseUrl}/api/v2/scenarios/${scenarioId}`,
    { headers: { Authorization: `Token ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`Make scenario API returned ${res.status}`);
  const json = await res.json() as Record<string, unknown>;
  const scenario = (json.scenario ?? json) as Record<string, unknown>;
  const blueprint = (scenario.blueprint ?? {}) as Record<string, unknown>;
  const modules = Array.isArray(blueprint.modules) ? blueprint.modules as Record<string, unknown>[] : [];

  return modules.map((m) => ({
    'Module Name': String(m.label ?? m.name ?? ''),
    Type: String(m.module ?? m.type ?? ''),
    ID: String(m.id ?? ''),
    'Connected To': Array.isArray(m.routes)
      ? (m.routes as Record<string, unknown>[]).map(r => String(r.label ?? '')).join(' | ')
      : '',
  }));
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
  const exportMode = searchParams.get('export_mode') ?? 'full'; // 'full' | 'redacted' | 'nodes'

  if (!sourceId || !externalId || !platform || !type) {
    return NextResponse.json({ ok: false, code: 'MISSING_PARAMS' }, { status: 400 });
  }

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
  let filename = `${platform}_${externalId}_export.csv`;

  try {
    // ── Voice: Retell ──────────────────────────────────────────────────────────
    if (type === 'calls' && platform === 'retell') {
      const apiKey = String(secret.apiKey ?? '').trim();
      if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      const calls = await fetchRetellCalls(apiKey, externalId, 100);
      rows.push(['Date', 'Time', 'Duration (s)', 'Status', 'Sentiment', 'Cost ($)', 'Disconnection', 'Summary', 'Conversation'].map(csvEscape).join(','));
      for (const call of calls) {
        const d = new Date(Number(call.timestamp));
        let summary = String(call.summary);
        let transcript = formatTranscript(String(call.transcript));
        let disconnection = String(call.disconnectionReason);
        if (redact) {
          summary = redactPII(summary);
          transcript = redactPII(transcript);
          disconnection = redactPII(disconnection);
        }
        rows.push([
          d.toLocaleDateString('en-US'),
          d.toLocaleTimeString('en-US'),
          String(call.duration),
          String(call.status),
          String(call.sentiment),
          String(call.costTotal),
          disconnection,
          summary,
          transcript,
        ].map(csvEscape).join(','));
      }
      filename = `retell_calls_${new Date().toISOString().slice(0, 10)}.csv`;

    // ── Voice: Vapi ────────────────────────────────────────────────────────────
    } else if (type === 'calls' && platform === 'vapi') {
      const apiKey = String(secret.apiKey ?? '').trim();
      if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      const calls = await fetchVapiCalls(apiKey, externalId, 100);
      rows.push(['Date', 'Time', 'Duration (s)', 'Status', 'Cost ($)', 'Disconnection', 'Summary', 'Conversation'].map(csvEscape).join(','));
      for (const call of calls) {
        const d = new Date(Number(call.timestamp));
        let summary = String(call.summary);
        let transcript = formatTranscript(String(call.transcript));
        let disconnection = String(call.disconnectionReason);
        if (redact) {
          summary = redactPII(summary);
          transcript = redactPII(transcript);
          disconnection = redactPII(disconnection);
        }
        rows.push([
          d.toLocaleDateString('en-US'),
          d.toLocaleTimeString('en-US'),
          String(call.duration),
          String(call.status),
          String(call.costTotal),
          disconnection,
          summary,
          transcript,
        ].map(csvEscape).join(','));
      }
      filename = `vapi_calls_${new Date().toISOString().slice(0, 10)}.csv`;

    // ── Workflow: Make ─────────────────────────────────────────────────────────
    } else if (type === 'executions' && platform === 'make') {
      const apiKey = String(secret.apiKey ?? '').trim();
      const zone = String(secret.zone ?? secret.region ?? 'us1').trim();
      if (!apiKey) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      if (exportMode === 'nodes') {
        const nodes = await fetchMakeNodeSummary(apiKey, zone, externalId);
        if (nodes.length === 0) {
          rows.push(['Module Name', 'Type', 'ID', 'Connected To'].map(csvEscape).join(','));
        } else {
          const headers = Object.keys(nodes[0]);
          rows.push(headers.map(csvEscape).join(','));
          for (const n of nodes) {
            rows.push(headers.map(h => csvEscape((n as Record<string, unknown>)[h] ?? '')).join(','));
          }
        }
        filename = `make_node_summary_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        const executions = await fetchMakeExecutions(apiKey, zone, externalId, 100);
        if (executions.length === 0) {
          rows.push(['Timestamp', 'Status', 'Duration (ms)', 'Operations', 'Credits', 'Error Name', 'Error Message'].map(csvEscape).join(','));
        } else {
          const headers = Object.keys(executions[0]);
          rows.push(headers.map(csvEscape).join(','));
          for (const e of executions) {
            const row = headers.map(h => {
              const v = String((e as Record<string, unknown>)[h] ?? '');
              return csvEscape(redact ? redactPII(v) : v);
            });
            rows.push(row.join(','));
          }
        }
        filename = `make_executions_${new Date().toISOString().slice(0, 10)}.csv`;
      }

    // ── Workflow: n8n ──────────────────────────────────────────────────────────
    } else if (type === 'executions' && platform === 'n8n') {
      const apiKey = String(secret.apiKey ?? '').trim();
      const instanceUrl = String(secret.instanceUrl ?? '').trim().replace(/\/$/, '');
      if (!apiKey || !instanceUrl) return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });

      if (exportMode === 'nodes') {
        const nodes = await fetchN8nNodeSummary(apiKey, instanceUrl, externalId);
        if (nodes.length === 0) {
          rows.push(['Node Name', 'Type', 'Position X', 'Position Y', 'Connects To', 'On Error'].map(csvEscape).join(','));
        } else {
          const headers = Object.keys(nodes[0]);
          rows.push(headers.map(csvEscape).join(','));
          for (const n of nodes) {
            rows.push(headers.map(h => csvEscape((n as Record<string, unknown>)[h] ?? '')).join(','));
          }
        }
        filename = `n8n_node_summary_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        const executions = await fetchN8nExecutions(apiKey, instanceUrl, externalId, 100);

        if (executions.length === 0) {
          rows.push(['Timestamp', 'Status', 'Duration (ms)'].map(csvEscape).join(','));
        } else {
          // Dynamic columns: meta first, then all business payload fields
          const metaCols = ['Timestamp', 'Status', 'Duration (ms)'];
          const allKeys = Array.from(new Set(executions.flatMap(e => Object.keys(e))));
          const businessCols = allKeys.filter(k => !metaCols.includes(k));
          const headers = [...metaCols, ...businessCols];

          rows.push(headers.map(csvEscape).join(','));
          for (const e of executions) {
            rows.push(headers.map(h => {
              const v = String((e as Record<string, unknown>)[h] ?? '');
              return csvEscape(redact ? redactPII(v) : v);
            }).join(','));
          }
        }
        filename = `n8n_data_${new Date().toISOString().slice(0, 10)}.csv`;
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
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
