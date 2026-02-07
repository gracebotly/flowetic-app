import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../lib/supabase";
import { decryptSecret } from "@/lib/secrets";

const PlatformType = z.enum(["vapi", "n8n", "make", "retell"]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeBaseUrl(instanceUrl?: string | null): string | null {
  if (!instanceUrl) return null;
  try {
    const u = new URL(instanceUrl);
    return u.origin;
  } catch {
    return null;
  }
}

function extractWorkflows(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.workflows)) return raw.workflows;
  if (raw.data && Array.isArray(raw.data.data)) return raw.data.data;
  return [];
}

export const fetchPlatformEvents = createTool({
  id: "fetchPlatformEvents",
  description:
    "Fetch historical events from a connected platform API. Resolves credentials from Supabase sources table. Returns raw platform events.",
  inputSchema: z.object({
    sourceId: z.string().min(1),
    threadId: z.string().min(1),
    platformType: PlatformType,
    eventCount: z.number().int().min(1).max(500).default(100),
  }),
  outputSchema: z.object({
    events: z.array(z.any()),
    count: z.number().int(),
    platformType: z.string(),
    fetchedAt: z.string(),
  }),
  execute: async (inputData, context) => {
    const { platformType, sourceId } = inputData;
    const eventCount = inputData.eventCount ?? 100;

    // Get Supabase client from context to look up source credentials
    const accessToken = context?.requestContext?.get("supabaseAccessToken") as string;
    const tenantId = context?.requestContext?.get("tenantId") as string;

    if (!accessToken || !tenantId) {
      console.error("[fetchPlatformEvents] Missing auth context, falling back to empty");
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Look up source credentials from Supabase
    const { data: source, error: sourceErr } = await supabase
      .from("sources")
      .select("id, type, secret_hash, tenant_id")
      .eq("id", sourceId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (sourceErr || !source) {
      console.error("[fetchPlatformEvents] Source not found:", sourceId, sourceErr?.message);
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    if (!source.secret_hash) {
      console.error("[fetchPlatformEvents] Source has no credentials stored");
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    // Decrypt credentials
    let secret: any;
    try {
      secret = JSON.parse(decryptSecret(String(source.secret_hash)));
    } catch (e) {
      console.error("[fetchPlatformEvents] Failed to decrypt source credentials:", e);
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    // ── n8n ──────────────────────────────────────────────────
    if (platformType === "n8n") {
      return await fetchN8nEvents(secret, eventCount, tenantId, sourceId);
    }

    // ── make ─────────────────────────────────────────────────
    if (platformType === "make") {
      return await fetchMakeEvents(secret, eventCount, tenantId, sourceId);
    }

    // ── vapi ─────────────────────────────────────────────────
    if (platformType === "vapi") {
      return await fetchVapiEvents(secret, eventCount, tenantId, sourceId);
    }

    // ── retell ───────────────────────────────────────────────
    if (platformType === "retell") {
      return await fetchRetellEvents(secret, eventCount, tenantId, sourceId);
    }

    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  },
});

// ═══════════════════════════════════════════════════════════════
// n8n: Fetch workflow executions (ported from import route)
// ═══════════════════════════════════════════════════════════════
async function fetchN8nEvents(
  secret: any,
  eventCount: number,
  tenantId: string,
  sourceId: string,
) {
  const platformType = "n8n";

  if (secret.method !== "api" || !secret.apiKey) {
    console.error("[fetchPlatformEvents:n8n] API method required but not configured");
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }

  const baseUrl =
    normalizeBaseUrl(secret.instanceUrl) ??
    process.env.N8N_DEFAULT_BASE_URL ??
    null;

  if (!baseUrl) {
    console.error("[fetchPlatformEvents:n8n] No instance URL available");
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }

  const headers: Record<string, string> = {};
  if ((secret.authMode ?? "bearer") === "header") {
    headers["X-N8N-API-KEY"] = secret.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${secret.apiKey}`;
  }

  try {
    // Step 1: Fetch all workflows
    const wfRes = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: "GET",
      headers,
    });

    if (!wfRes.ok) {
      const text = await wfRes.text().catch(() => "");
      console.error(`[fetchPlatformEvents:n8n] Workflows API failed (${wfRes.status}): ${text}`);
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const wfRaw = await wfRes.json().catch(() => null);
    const workflows = extractWorkflows(wfRaw);

    if (workflows.length === 0) {
      console.warn("[fetchPlatformEvents:n8n] No workflows found");
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    // Step 2: Fetch executions for each workflow
    const allEvents: any[] = [];
    const perWorkflowLimit = Math.max(5, Math.ceil(eventCount / workflows.length));

    for (const wf of workflows) {
      const wfId = String(wf.id);

      try {
        const execRes = await fetch(
          `${baseUrl}/api/v1/executions?workflowId=${wfId}&limit=${perWorkflowLimit}`,
          { method: "GET", headers },
        );

        if (!execRes.ok) continue;

        const execData = await execRes.json().catch(() => ({}));
        const executions = execData.data || execData || [];

        if (!Array.isArray(executions)) continue;

        for (const exec of executions) {
          const isError = exec.stoppedAt || exec.status === "error";
          allEvents.push({
            // Raw event shape that normalizeEvents expects
            type: "workflow_execution",
            name: `n8n:${wf.name || wfId}:execution`,
            value: isError ? 0 : 1,
            labels: {
              workflow_id: wfId,
              workflow_name: wf.name || wfId,
              execution_id: String(exec.id),
              status: isError ? "error" : "success",
              platform: "n8n",
            },
            timestamp: exec.startedAt || exec.createdAt || nowIso(),
            tenant_id: tenantId,
            source_id: sourceId,
          });

          if (allEvents.length >= eventCount) break;
        }
      } catch (e) {
        console.error(`[fetchPlatformEvents:n8n] Failed to fetch executions for workflow ${wfId}:`, e);
      }

      if (allEvents.length >= eventCount) break;
    }

    console.log(`[fetchPlatformEvents:n8n] Fetched ${allEvents.length} events from ${workflows.length} workflows`);

    return {
      events: allEvents,
      count: allEvents.length,
      platformType,
      fetchedAt: nowIso(),
    };
  } catch (e: any) {
    console.error("[fetchPlatformEvents:n8n] Unexpected error:", e?.message || e);
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }
}

// ═══════════════════════════════════════════════════════════════
// Make: Fetch scenario executions
// ═══════════════════════════════════════════════════════════════
async function fetchMakeEvents(
  secret: any,
  eventCount: number,
  tenantId: string,
  sourceId: string,
) {
  const platformType = "make";

  if (!secret.apiKey || !secret.region) {
    console.error("[fetchPlatformEvents:make] API key and region required");
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }

  const region = secret.region;
  const apiKey = secret.apiKey;
  const makeHeaders = {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // Get organizations
    const orgRes = await fetch(`https://${region}.make.com/api/v2/organizations`, {
      method: "GET",
      headers: makeHeaders,
    });

    if (!orgRes.ok) {
      console.error(`[fetchPlatformEvents:make] Org API failed (${orgRes.status})`);
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const orgData = await orgRes.json().catch(() => ({}));
    const orgs = orgData.organizations || [];
    if (orgs.length === 0) {
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const orgId = secret.organizationId || orgs[0]?.id;
    if (!orgId) {
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    // Get teams
    const teamsRes = await fetch(
      `https://${region}.make.com/api/v2/organizations/${orgId}/teams`,
      { method: "GET", headers: makeHeaders },
    );

    if (!teamsRes.ok) {
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const teamsData = await teamsRes.json().catch(() => ({}));
    const teams = teamsData.teams || [];

    const allEvents: any[] = [];

    for (const team of teams) {
      // Get scenarios for team
      const scenarioRes = await fetch(
        `https://${region}.make.com/api/v2/scenarios?teamId=${team.id}`,
        { method: "GET", headers: makeHeaders },
      );

      if (!scenarioRes.ok) continue;

      const scenarioData = await scenarioRes.json().catch(() => ({}));
      const scenarios = scenarioData.scenarios || [];

      for (const scenario of scenarios) {
        allEvents.push({
          type: "workflow_execution",
          name: `make:${scenario.name || scenario.id}:scenario`,
          value: scenario.islinked ? 1 : 0,
          labels: {
            scenario_id: String(scenario.id),
            scenario_name: scenario.name || String(scenario.id),
            team_id: String(team.id),
            status: scenario.islinked ? "active" : "inactive",
            platform: "make",
          },
          timestamp: scenario.updatedAt || scenario.createdAt || nowIso(),
          tenant_id: tenantId,
          source_id: sourceId,
        });

        if (allEvents.length >= eventCount) break;
      }

      if (allEvents.length >= eventCount) break;
    }

    return {
      events: allEvents,
      count: allEvents.length,
      platformType,
      fetchedAt: nowIso(),
    };
  } catch (e: any) {
    console.error("[fetchPlatformEvents:make] Unexpected error:", e?.message || e);
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }
}

// ═══════════════════════════════════════════════════════════════
// Vapi: Fetch assistant call logs
// ═══════════════════════════════════════════════════════════════
async function fetchVapiEvents(
  secret: any,
  eventCount: number,
  tenantId: string,
  sourceId: string,
) {
  const platformType = "vapi";

  const apiKey = String(secret?.apiKey || "").trim();
  if (!apiKey) {
    console.error("[fetchPlatformEvents:vapi] Missing API key");
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }

  const vapiHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // Fetch calls
    const callsRes = await fetch(`https://api.vapi.ai/call?limit=${eventCount}`, {
      method: "GET",
      headers: vapiHeaders,
    });

    if (!callsRes.ok) {
      console.error(`[fetchPlatformEvents:vapi] Calls API failed (${callsRes.status})`);
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const callsRaw = await callsRes.json().catch(() => []);
    const calls = Array.isArray(callsRaw) ? callsRaw : [];

    const allEvents = calls.slice(0, eventCount).map((call: any) => ({
      type: "workflow_execution",
      name: `vapi:${call.assistantId || "unknown"}:call`,
      value: call.status === "ended" ? 1 : 0,
      labels: {
        call_id: String(call.id),
        assistant_id: call.assistantId || "unknown",
        status: call.status || "unknown",
        duration: call.duration,
        platform: "vapi",
      },
      timestamp: call.createdAt || call.startedAt || nowIso(),
      tenant_id: tenantId,
      source_id: sourceId,
    }));

    return {
      events: allEvents,
      count: allEvents.length,
      platformType,
      fetchedAt: nowIso(),
    };
  } catch (e: any) {
    console.error("[fetchPlatformEvents:vapi] Unexpected error:", e?.message || e);
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }
}

// ═══════════════════════════════════════════════════════════════
// Retell: Fetch agent call logs
// ═══════════════════════════════════════════════════════════════
async function fetchRetellEvents(
  secret: any,
  eventCount: number,
  tenantId: string,
  sourceId: string,
) {
  const platformType = "retell";

  const apiKey = String(secret?.apiKey || "").trim();
  if (!apiKey) {
    console.error("[fetchPlatformEvents:retell] Missing API key");
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }

  const retellHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // Fetch calls
    const callsRes = await fetch("https://api.retellai.com/v2/list-calls", {
      method: "POST",
      headers: retellHeaders,
      body: JSON.stringify({ limit: eventCount }),
    });

    if (!callsRes.ok) {
      console.error(`[fetchPlatformEvents:retell] Calls API failed (${callsRes.status})`);
      return { events: [], count: 0, platformType, fetchedAt: nowIso() };
    }

    const callsRaw = await callsRes.json().catch(() => []);
    const calls = Array.isArray(callsRaw) ? callsRaw : [];

    const allEvents = calls.slice(0, eventCount).map((call: any) => ({
      type: "workflow_execution",
      name: `retell:${call.agent_id || "unknown"}:call`,
      value: call.call_status === "ended" ? 1 : 0,
      labels: {
        call_id: String(call.call_id),
        agent_id: call.agent_id || "unknown",
        status: call.call_status || "unknown",
        duration: call.end_timestamp && call.start_timestamp
          ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
          : undefined,
        platform: "retell",
      },
      timestamp: call.start_timestamp
        ? new Date(call.start_timestamp).toISOString()
        : nowIso(),
      tenant_id: tenantId,
      source_id: sourceId,
    }));

    return {
      events: allEvents,
      count: allEvents.length,
      platformType,
      fetchedAt: nowIso(),
    };
  } catch (e: any) {
    console.error("[fetchPlatformEvents:retell] Unexpected error:", e?.message || e);
    return { events: [], count: 0, platformType, fetchedAt: nowIso() };
  }
}
