import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/secrets';

export const runtime = 'nodejs';

interface RetellProductCost {
  product?: string;
  cost?: number;
}

interface RetellCall {
  call_id?: string;
  call_type?: string;
  call_status?: string;
  duration_ms?: number;
  start_timestamp?: number;
  end_timestamp?: number;
  transcript?: string;
  recording_url?: string | null;
  disconnection_reason?: string;
  call_analysis?: {
    user_sentiment?: string;
    call_summary?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, unknown> | null;
  };
  call_cost?: {
    combined_cost?: number;
    product_costs?: RetellProductCost[];
  };
}

function formatRetellProduct(product: string): string {
  if (product === 'retell_voice_engine') return 'Voice Engine';
  if (product === 'elevenlabs_tts_new' || product === 'elevenlabs_tts') return 'ElevenLabs TTS';
  if (product === 'gpt_4_1') return 'GPT-4.1';
  return product.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
  const agentId = searchParams.get('agent_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 10) || 10, 10);

  if (!sourceId || !agentId) {
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

  const response = await fetch('https://api.retellai.com/v2/list-calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter_criteria: { agent_id: [agentId] },
      limit,
      sort_order: 'descending',
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json({ ok: false, code: 'RETELL_FETCH_FAILED', error: message }, { status: 502 });
  }

  const payload = await response.json();
  const rawCalls = Array.isArray(payload) ? payload : Array.isArray(payload?.calls) ? payload.calls : [];
  const calls = (rawCalls as RetellCall[]).map((call) => {
    const duration = call.duration_ms
      ? Math.round(call.duration_ms / 1000)
      : (call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : 0);

    const costTotal = typeof call.call_cost?.combined_cost === 'number'
      ? call.call_cost.combined_cost / 10000
      : 0;

    const costBreakdown = (call.call_cost?.product_costs ?? []).map((pc) => ({
      label: formatRetellProduct(String(pc.product ?? 'Unknown')),
      cost: (pc.cost ?? 0) / 10000,
    }));

    return {
      id: String(call.call_id ?? ''),
      callType: String(call.call_type ?? 'web_call'),
      status: String(call.call_status ?? 'unknown'),
      duration,
      sentiment: String(call.call_analysis?.user_sentiment ?? 'Unknown'),
      summary: String(call.call_analysis?.call_summary ?? ''),
      successful: Boolean(call.call_analysis?.call_successful ?? false),
      transcript: String(call.transcript ?? ''),
      recordingUrl: call.recording_url ?? null,
      disconnectionReason: String(call.disconnection_reason ?? ''),
      timestamp: Number(call.start_timestamp ?? Date.now()),
      costTotal,
      costBreakdown,
      customAnalysisData: call.call_analysis?.custom_analysis_data ?? null,
    };
  });

  return NextResponse.json({ ok: true, calls });
}
