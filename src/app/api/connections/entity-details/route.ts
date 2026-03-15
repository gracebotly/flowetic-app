import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "NO_TENANT" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("source_id");
  const externalId = searchParams.get("external_id");
  const platform = searchParams.get("platform");

  if (!sourceId || !externalId || !platform) {
    return NextResponse.json({ ok: false, code: "MISSING_PARAMS" }, { status: 400 });
  }

  const { data: source } = await supabase
    .from("sources")
    .select("id, type, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) {
    return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  }

  const decrypted = source.secret_hash ? decryptSecret(String(source.secret_hash)) : "";
  let secretJson: Record<string, unknown> = {};
  try {
    secretJson = decrypted ? JSON.parse(decrypted) : {};
  } catch {
    // empty
  }

  const { data: events } = await supabase
    .from("events")
    .select("state, timestamp")
    .eq("tenant_id", membership.tenant_id)
    .eq("source_id", sourceId)
    .order("timestamp", { ascending: false })
    .limit(500);

  const allEvents = events ?? [];

  const entityEvents = allEvents.filter((e: any) => {
    const state = e.state as Record<string, unknown> | null;
    if (!state) return false;
    const wfId = String(state.workflow_id ?? state.execution_id ?? "");
    return wfId === externalId || String(state.execution_id ?? "") === externalId;
  });

  const totalEvents = entityEvents.length;
  const successEvents = entityEvents.filter((e: any) => {
    const status = String((e.state as any)?.status ?? "");
    return status === "success" || status === "completed" || status === "ended";
  }).length;
  const successRate = totalEvents > 0 ? Math.round((successEvents / totalEvents) * 100) : 0;

  const durations = entityEvents.map((e: any) => Number((e.state as any)?.duration_ms ?? 0)).filter((d: number) => d > 0);
  const avgDuration =
    durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;

  const costs = entityEvents.map((e: any) => Number((e.state as any)?.cost ?? 0)).filter((c: number) => c > 0);
  const totalCost = costs.reduce((a: number, b: number) => a + b, 0);

  const stats: Stats = { totalEvents, successEvents, successRate, avgDuration, totalCost };

  try {
    if (platform === "retell") {
      return await fetchRetellDetails(secretJson, externalId, stats);
    } else if (platform === "vapi") {
      return await fetchVapiDetails(secretJson, externalId, stats);
    } else if (platform === "make") {
      return await fetchMakeDetails(secretJson, externalId, stats);
    } else if (platform === "n8n") {
      return await fetchN8nDetails(secretJson, externalId, stats);
    }
    return NextResponse.json({ ok: true, platform, details: null, stats });
  } catch (err: any) {
    console.error(`[entity-details] ${platform} fetch failed:`, err?.message);
    return NextResponse.json({ ok: true, platform, details: null, stats, error: err?.message });
  }
}

type Stats = {
  totalEvents: number;
  successEvents: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
  latestError?: string;
};

async function fetchRetellDetails(secret: Record<string, unknown>, agentId: string, stats: Stats) {
  const apiKey = String(secret?.apiKey ?? "").trim();
  if (!apiKey) return NextResponse.json({ ok: true, platform: "retell", details: null, stats });

  const res = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) return NextResponse.json({ ok: true, platform: "retell", details: null, stats });

  const agent = await res.json();
  return NextResponse.json({
    ok: true,
    platform: "retell",
    details: {
      agent_name: agent.agent_name,
      voice_id: agent.voice_id,
      voice_model: agent.voice_model,
      language: agent.language,
      responsiveness: agent.responsiveness,
      interruption_sensitivity: agent.interruption_sensitivity,
      voice_speed: agent.voice_speed,
      voice_temperature: agent.voice_temperature,
      webhook_url: agent.webhook_url,
      max_call_duration_ms: agent.max_call_duration_ms,
      post_call_analysis_model: agent.post_call_analysis_model,
      llm_id: agent.response_engine?.llm_id,
      last_modification_timestamp: agent.last_modification_timestamp,
    },
    stats,
  });
}

async function fetchVapiDetails(secret: Record<string, unknown>, assistantId: string, stats: Stats) {
  const apiKey = String(secret?.apiKey ?? "").trim();
  if (!apiKey) return NextResponse.json({ ok: true, platform: "vapi", details: null, stats });

  const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) return NextResponse.json({ ok: true, platform: "vapi", details: null, stats });

  const assistant = await res.json();
  return NextResponse.json({
    ok: true,
    platform: "vapi",
    details: {
      name: assistant.name,
      firstMessage: assistant.firstMessage,
      llm_provider: assistant.llm?.provider ?? assistant.model?.provider,
      llm_model: assistant.llm?.model ?? assistant.model?.model,
      voice_provider: assistant.voice?.provider,
      voice_id: assistant.voice?.voiceId,
      voice_model: assistant.voice?.model,
      transcriber_provider: assistant.transcriber?.provider,
      transcriber_model: assistant.transcriber?.model,
      tool_count: assistant.toolIds?.length ?? 0,
      created_at: assistant.createdAt,
      updated_at: assistant.updatedAt,
    },
    stats,
  });
}

async function fetchMakeDetails(secret: Record<string, unknown>, scenarioId: string, stats: Stats) {
  const apiKey = String(secret?.apiKey ?? "").trim();
  const zone = String(secret?.zone ?? secret?.region ?? "us1").trim();
  if (!apiKey) return NextResponse.json({ ok: true, platform: "make", details: null, stats });

  const baseUrl = zone.includes(".") ? `https://${zone}` : `https://${zone}.make.com`;
  const makeHeaders = { Authorization: `Token ${apiKey}` };

  const res = await fetch(`${baseUrl}/api/v2/scenarios/${scenarioId}`, {
    headers: makeHeaders,
  });

  if (!res.ok) return NextResponse.json({ ok: true, platform: "make", details: null, stats });

  const data = await res.json();
  const scenario = data.scenario ?? data;
  const modules = scenario.blueprint?.flow ?? [];

  // ── Pull aggregate stats ──
  // The single-scenario GET endpoint does NOT return execution stats.
  // We must call the list endpoint to get executions/errors/operations/centicredits.
  // Use teamId (from scenario detail) for a direct, reliable lookup.
  let makeExecs = 0;
  let makeErrors = 0;
  let makeOps = 0;
  let makeCenticredits = 0;
  let makeTransfer = 0;

  const teamId = scenario.teamId;
  try {
    if (teamId) {
      const listRes = await fetch(
        `${baseUrl}/api/v2/scenarios?teamId=${teamId}`,
        { headers: makeHeaders },
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const allScenarios = Array.isArray(listData?.scenarios) ? listData.scenarios : [];
        const match = allScenarios.find((s: any) => String(s.id) === scenarioId);
        if (match) {
          makeExecs = typeof match.executions === "number" ? match.executions : 0;
          makeErrors = typeof match.errors === "number" ? match.errors : 0;
          makeOps = typeof match.operations === "number" ? match.operations : 0;
          makeCenticredits = typeof match.centicredits === "number" ? match.centicredits : 0;
          makeTransfer = typeof match.transfer === "number" ? match.transfer : 0;
        }
      }
    }
  } catch (err) {
    console.error('[entity-details/make] teamId lookup failed:', err instanceof Error ? err.message : err);
  }

  if (makeOps > 0 && makeExecs === 0) {
    makeExecs = makeOps;
  }

  console.info(`[entity-details/make] scenarioId=${scenarioId} teamId=${teamId} makeExecs=${makeExecs} makeOps=${makeOps} makeErrors=${makeErrors}`);

  // ── Check for recent execution errors ──
  let latestError: string | undefined;
  try {
    const execRes = await fetch(
      `${baseUrl}/api/v2/scenarios/${scenarioId}/logs?pg[limit]=10&pg[sortDir]=desc`,
      { headers: makeHeaders },
    );
    if (execRes.ok) {
      const execData = await execRes.json();
      const rawExecs = Array.isArray(execData) ? execData : Array.isArray(execData?.scenarioLogs) ? execData.scenarioLogs : [];
      const errorExecs = rawExecs.filter(
        (e: any) => e.type === "auto" && e.eventType === "EXECUTION_END" && e.status === 3,
      );
      if (errorExecs.length > 0) {
        latestError = errorExecs[0]?.error?.message;
      }
    }
  } catch {
    // non-fatal
  }

  // Use Make's aggregate stats when Supabase has nothing
  const enrichedStats: Stats = stats.totalEvents > 0 ? stats : {
    totalEvents: makeExecs,
    successEvents: Math.max(0, makeExecs - makeErrors),
    successRate: makeExecs > 0 ? Math.round(((makeExecs - makeErrors) / makeExecs) * 100) : 0,
    avgDuration: stats.avgDuration,
    totalCost: 0,
    latestError: latestError ?? undefined,
  };

  return NextResponse.json({
    ok: true,
    platform: "make",
    details: {
      name: scenario.name,
      description: scenario.description,
      is_active: scenario.isActive ?? false,
      is_paused: scenario.isPaused ?? false,
      scheduling_type: scenario.scheduling?.type,
      scheduling_interval: scenario.scheduling?.interval,
      module_count: modules.length,
      modules_used: modules.map((m: any) => String(m.module ?? "")).filter(Boolean),
      used_packages: scenario.usedPackages ?? [],
      team_id: scenario.teamId,
      folder_id: scenario.folderId,
      created: scenario.created,
      last_edit: scenario.lastEdit,
      created_by: scenario.createdByUser?.name,
      // Aggregate stats from Make API
      make_total_executions: makeExecs,
      make_total_operations: makeOps,
      make_total_errors: makeErrors,
      make_centicredits: makeCenticredits,
      make_data_transfer_bytes: makeTransfer,
      // Connection health
      latest_error: latestError,
      // Trigger type detection — webhook/instant scenarios don't return execution logs
      is_instant_trigger: scenario.scheduling?.type === "immediately",
      hook_id: scenario.hookId ?? null,
      trigger_module: modules.length > 0 ? String(modules[0].module ?? "") : null,
    },
    stats: enrichedStats,
  });
}

async function fetchN8nDetails(secret: Record<string, unknown>, workflowId: string, stats: Stats) {
  const baseUrl = String(secret?.instanceUrl ?? secret?.baseUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  const apiKey = String(secret?.apiKey ?? "").trim();
  if (!baseUrl || !apiKey) return NextResponse.json({ ok: true, platform: "n8n", details: null, stats });

  const n8nHeaders: Record<string, string> = { "X-N8N-API-KEY": apiKey };

  const res = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    headers: n8nHeaders,
  });

  if (!res.ok) return NextResponse.json({ ok: true, platform: "n8n", details: null, stats });

  const workflow = await res.json();
  const nodes = workflow.nodes ?? [];
  const nodeTypes = [...new Set(nodes.map((n: any) => String(n.type ?? "").replace("n8n-nodes-base.", "")))];

  // ── Pull execution stats from n8n when Supabase has nothing ──
  let enrichedStats = stats;
  let latestError: string | undefined;

  if (stats.totalEvents === 0) {
    try {
      const execRes = await fetch(
        `${baseUrl}/api/v1/executions?workflowId=${workflowId}&limit=20`,
        { headers: n8nHeaders },
      );
      if (execRes.ok) {
        const execData = await execRes.json();
        const executions = execData.data || execData || [];
        if (Array.isArray(executions) && executions.length > 0) {
          const total = executions.length;
          const errors = executions.filter(
            (e: any) => e.status === "error" || e.status === "crashed",
          ).length;
          const durations = executions
            .map((e: any) => {
              if (!e.startedAt || !e.stoppedAt) return 0;
              return Math.max(0, new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime());
            })
            .filter((d: number) => d > 0);
          const avgDur = durations.length > 0
            ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
            : 0;

          enrichedStats = {
            totalEvents: total,
            successEvents: total - errors,
            successRate: Math.round(((total - errors) / total) * 100),
            avgDuration: avgDur,
            totalCost: 0,
          };

          // Get latest error
          const firstError = executions.find(
            (e: any) => e.status === "error" || e.status === "crashed",
          );
          if (firstError) {
            const errData = firstError.data?.resultData?.error;
            latestError = errData?.message || `Execution ${firstError.id} failed`;
          }
        }
      }
    } catch {
      // non-fatal
    }
  }

  enrichedStats = {
    ...enrichedStats,
    latestError: latestError ?? undefined,
  };

  return NextResponse.json({
    ok: true,
    platform: "n8n",
    details: {
      name: workflow.name,
      active: workflow.active ?? false,
      node_count: nodes.length,
      node_types: nodeTypes,
      tags: (workflow.tags ?? []).map((t: any) => t.name ?? t),
      created_at: workflow.createdAt,
      updated_at: workflow.updatedAt,
      latest_error: latestError,
    },
    stats: enrichedStats,
  });
}
