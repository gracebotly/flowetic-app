import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/secrets';

export const runtime = 'nodejs';

interface VapiCallListItem {
  id?: string;
}

interface VapiCallDetail {
  id?: string;
  type?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  endedReason?: string;
  cost?: number;
  costBreakdown?: {
    total?: number;
    transport?: number;
    stt?: number;
    llm?: number;
    tts?: number;
    vapi?: number;
  };
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    recording?: {
      stereoUrl?: string;
      mono?: {
        combinedUrl?: string;
        assistantUrl?: string;
        customerUrl?: string;
      };
    };
    performanceMetrics?: Record<string, unknown> | null;
  };
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown> | null;
    successEvaluation?: string | null;
  };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: 'NO_TENANT' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('source_id');
  const assistantId = searchParams.get('assistant_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 10) || 10, 10);

  if (!sourceId || !assistantId) {
    return NextResponse.json({ ok: false, code: 'MISSING_PARAMS' }, { status: 400 });
  }

  const { data: source } = await supabase
    .from('sources')
    .select('secret_hash')
    .eq('id', sourceId)
    .eq('tenant_id', membership.tenant_id)
    .maybeSingle();

  if (!source?.secret_hash) {
    return NextResponse.json({ ok: false, code: 'SOURCE_NOT_FOUND' }, { status: 404 });
  }

  let secret: Record<string, unknown> = {};
  try {
    secret = JSON.parse(decryptSecret(String(source.secret_hash)));
  } catch {
    return NextResponse.json({ ok: false, code: 'INVALID_SECRET' }, { status: 400 });
  }

  const apiKey = String(secret.apiKey ?? '').trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, code: 'MISSING_API_KEY' }, { status: 400 });
  }

  const listResponse = await fetch(`https://api.vapi.ai/call?assistantId=${assistantId}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!listResponse.ok) {
    const message = await listResponse.text();
    return NextResponse.json({ ok: false, code: 'VAPI_LIST_FAILED', error: message }, { status: 502 });
  }

  const listPayload = await listResponse.json();
  const listCalls = (Array.isArray(listPayload) ? listPayload : []) as VapiCallListItem[];

  const fullCalls = await Promise.all(
    listCalls.slice(0, limit).map(async (entry) => {
      if (!entry.id) return null;
      const detailResponse = await fetch(`https://api.vapi.ai/call/${entry.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!detailResponse.ok) return null;
      const detail = await detailResponse.json();
      return detail as VapiCallDetail;
    }),
  );

  const calls = fullCalls
    .filter((call): call is VapiCallDetail => Boolean(call?.id))
    .map((call) => {
      const duration = call.startedAt && call.endedAt
        ? Math.max(0, Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000))
        : 0;

      return {
        id: String(call.id ?? ''),
        callType: String(call.type ?? 'webCall'),
        status: String(call.status ?? 'unknown'),
        duration,
        sentiment: 'Unknown',
        summary: String(call.analysis?.summary ?? ''),
        successful: call.analysis?.successEvaluation ?? null,
        transcript: String(call.artifact?.transcript ?? ''),
        recordingUrl: call.artifact?.recording?.mono?.combinedUrl
          ?? call.artifact?.recordingUrl
          ?? null,
        stereoRecordingUrl: call.artifact?.recording?.stereoUrl
          ?? call.artifact?.stereoRecordingUrl
          ?? null,
        assistantRecordingUrl: call.artifact?.recording?.mono?.assistantUrl ?? null,
        customerRecordingUrl: call.artifact?.recording?.mono?.customerUrl ?? null,
        disconnectionReason: String(call.endedReason ?? ''),
        timestamp: new Date(String(call.createdAt ?? Date.now())).getTime(),
        costTotal: call.costBreakdown?.total ?? call.cost ?? 0,
        costBreakdown: [
          { label: 'Transport', cost: call.costBreakdown?.transport ?? 0 },
          { label: 'STT', cost: call.costBreakdown?.stt ?? 0 },
          { label: 'LLM', cost: call.costBreakdown?.llm ?? 0 },
          { label: 'TTS', cost: call.costBreakdown?.tts ?? 0 },
          { label: 'Vapi Fee', cost: call.costBreakdown?.vapi ?? 0 },
        ].filter((item) => item.cost > 0),
        structuredData: call.analysis?.structuredData ?? null,
        successEvaluation: call.analysis?.successEvaluation ?? null,
        performanceMetrics: call.artifact?.performanceMetrics ?? null,
      };
    });

  return NextResponse.json({ ok: true, calls });
}
