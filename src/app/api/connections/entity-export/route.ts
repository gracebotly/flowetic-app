import { NextResponse } from 'next/server';

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

async function fetchInternal(req: Request, path: string) {
  const url = new URL(req.url);
  const target = `${url.origin}${path}`;
  return fetch(target, { headers: { cookie: req.headers.get('cookie') ?? '' } });
}

export async function GET(req: Request) {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: membership } = await supabase.from('memberships').select('tenant_id').eq('user_id', user.id).limit(1).maybeSingle();
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

  const rows: string[] = ['# AGENCY INTERNAL — NOT FOR CLIENT DISTRIBUTION'];

  if (type === 'calls' && (platform === 'retell' || platform === 'vapi')) {
    const qs = platform === 'retell'
      ? `/api/connections/entity-calls/retell?source_id=${sourceId}&agent_id=${externalId}&limit=50`
      : `/api/connections/entity-calls/vapi?source_id=${sourceId}&assistant_id=${externalId}&limit=50`;

    let json: Record<string, unknown> = {};
    try {
      const res = await fetchInternal(req, qs);
      if (!res.ok) return NextResponse.json({ ok: false, code: 'INTERNAL_FETCH_FAILED' }, { status: 502 });
      json = await res.json();
    } catch {
      return NextResponse.json({ ok: false, code: 'INTERNAL_FETCH_FAILED', error: 'Could not fetch data for export. Try again.' }, { status: 502 });
    }

    const calls = Array.isArray(json?.calls) ? json.calls : [];

    rows.push(['Date', 'Time', 'Duration', 'Status', 'Sentiment', 'Summary', 'Cost', 'Disconnection Reason'].map(csvEscape).join(','));
    for (const c of calls) {
      const call = c as Record<string, unknown>;
      const d = new Date(Number(call.timestamp ?? Date.now()));
      const summary = redact ? redactPII(String(call.summary ?? '')) : String(call.summary ?? '');
      const reason = redact ? redactPII(String(call.disconnectionReason ?? '')) : String(call.disconnectionReason ?? '');
      rows.push([
        d.toLocaleDateString('en-US'),
        d.toLocaleTimeString('en-US'),
        String(call.duration ?? 0),
        String(call.status ?? ''),
        String(call.sentiment ?? ''),
        summary,
        String(call.costTotal ?? 0),
        reason,
      ].map(csvEscape).join(','));
    }
  } else if (type === 'executions' && (platform === 'make' || platform === 'n8n')) {
    const qs = platform === 'make'
      ? `/api/connections/entity-executions/make?source_id=${sourceId}&scenario_id=${externalId}&limit=50`
      : `/api/connections/entity-executions/n8n?source_id=${sourceId}&workflow_id=${externalId}&limit=50`;

    let json: Record<string, unknown> = {};
    try {
      const res = await fetchInternal(req, qs);
      if (!res.ok) return NextResponse.json({ ok: false, code: 'INTERNAL_FETCH_FAILED' }, { status: 502 });
      json = await res.json();
    } catch {
      return NextResponse.json({ ok: false, code: 'INTERNAL_FETCH_FAILED', error: 'Could not fetch data for export. Try again.' }, { status: 502 });
    }

    const executions = Array.isArray(json?.executions) ? json.executions : [];

    rows.push(['Execution ID', 'Timestamp', 'Status', 'Duration (ms)', 'Operations', 'Credits', 'Error Name', 'Error Message'].map(csvEscape).join(','));
    for (const e of executions) {
      const execution = e as Record<string, unknown>;
      rows.push([
        String(execution.id ?? ''),
        String(execution.timestamp ?? ''),
        String(execution.status ?? ''),
        String(execution.duration ?? ''),
        String(execution.operations ?? ''),
        String(execution.centicredits ?? ''),
        String(execution.errorName ?? ''),
        String(execution.errorMessage ?? ''),
      ].map(csvEscape).join(','));
    }
  } else {
    return NextResponse.json({ ok: false, code: 'UNSUPPORTED' }, { status: 400 });
  }

  const csv = rows.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${platform}_${type}_export.csv"`,
    },
  });
}
