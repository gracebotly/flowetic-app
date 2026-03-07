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

    const res = await fetchInternal(req, qs);
    const json = await res.json();
    const calls = Array.isArray(json?.calls) ? json.calls : [];

    rows.push(['Date', 'Time', 'Duration', 'Status', 'Sentiment', 'Summary', 'Cost', 'Disconnection Reason'].map(csvEscape).join(','));
    for (const c of calls) {
      const d = new Date(c.timestamp ?? Date.now());
      const summary = redact ? redactPII(String(c.summary ?? '')) : String(c.summary ?? '');
      const reason = redact ? redactPII(String(c.disconnectionReason ?? '')) : String(c.disconnectionReason ?? '');
      rows.push([
        d.toLocaleDateString('en-US'),
        d.toLocaleTimeString('en-US'),
        String(c.duration ?? 0),
        String(c.status ?? ''),
        String(c.sentiment ?? ''),
        summary,
        String(c.costTotal ?? 0),
        reason,
      ].map(csvEscape).join(','));
    }
  } else if (type === 'executions' && (platform === 'make' || platform === 'n8n')) {
    const qs = platform === 'make'
      ? `/api/connections/entity-executions/make?source_id=${sourceId}&scenario_id=${externalId}&limit=50`
      : `/api/connections/entity-executions/n8n?source_id=${sourceId}&workflow_id=${externalId}&limit=50`;
    const res = await fetchInternal(req, qs);
    const json = await res.json();
    const executions = Array.isArray(json?.executions) ? json.executions : [];

    rows.push(['Execution ID', 'Timestamp', 'Status', 'Duration (ms)', 'Operations', 'Credits', 'Error Name', 'Error Message'].map(csvEscape).join(','));
    for (const e of executions) {
      rows.push([
        String(e.id ?? ''),
        String(e.timestamp ?? ''),
        String(e.status ?? ''),
        String(e.duration ?? ''),
        String(e.operations ?? ''),
        String(e.centicredits ?? ''),
        String(e.errorName ?? ''),
        String(e.errorMessage ?? ''),
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
