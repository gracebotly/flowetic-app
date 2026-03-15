import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPayloadFields } from "@/mastra/normalizers/extractPayloadFields";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { sourceId, workflowExternalId } = body as {
    sourceId?: string;
    workflowExternalId?: string;
  };

  if (!sourceId) {
    return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "NO_MEMBERSHIP" }, { status: 403 });
  }

  const tenantId = membership.tenant_id;

  const { data: source } = await supabase
    .from("sources")
    .select("id, type, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!source) {
    return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  }

  // ── For non-n8n platforms, delegate to their existing import routes ──
  // The import routes already do: fetch from API → upsert entities → insert events → update last_seen_at
  if (source.type !== "n8n") {
    const platformType = source.type as string;
    const supportedPlatforms = ["vapi", "retell", "make"];

    if (!supportedPlatforms.includes(platformType)) {
      return NextResponse.json(
        { ok: false, code: "UNSUPPORTED_PLATFORM", message: `Platform "${platformType}" is not supported for refresh.` },
        { status: 400 },
      );
    }

    try {
      // Build internal request to the platform's import route
      const importUrl = new URL(
        `/api/connections/inventory/${platformType}/import`,
        req.nextUrl.origin,
      );

      // Forward auth by cloning cookies from the incoming request
      const importRes = await fetch(importUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({ sourceId }),
      });

      const importJson = await importRes.json().catch(() => ({}));

      if (!importRes.ok || !importJson?.ok) {
        return NextResponse.json(
          {
            ok: false,
            code: importJson?.code || "REFRESH_FAILED",
            message: importJson?.message || `Failed to refresh ${platformType} data.`,
          },
          { status: importRes.status || 500 },
        );
      }

      // Update last_seen_at on source_entities from the latest events
      const now = new Date().toISOString();
      try {
        const { data: latestEvents } = await supabase
          .from("events")
          .select("state, labels, timestamp")
          .eq("tenant_id", tenantId)
          .eq("source_id", sourceId)
          .order("timestamp", { ascending: false })
          .limit(200);

        if (latestEvents && latestEvents.length > 0) {
          // Use state.workflow_id as the primary entity identifier — it is the canonical
          // field set by ALL import routes (Retell, Vapi, Make, n8n).
          // Fall back to labels for legacy compatibility.
          const labelKeys = platformType === "vapi" ? ["assistant_id"]
            : platformType === "retell" ? ["agent_id"]
            : platformType === "make" ? ["scenario_id", "workflow_id"]
            : ["workflow_id"];

          const latestByEntity = new Map<string, string>();
          for (const ev of latestEvents) {
            const state = ev.state as Record<string, unknown> | null;
            const labels = ev.labels as Record<string, string> | null;

            // Primary: state.workflow_id (canonical for all platforms)
            const stateWfId = state ? String(state.workflow_id ?? "") : "";
            if (stateWfId && stateWfId !== "undefined" && stateWfId !== "null" && !latestByEntity.has(stateWfId)) {
              latestByEntity.set(stateWfId, String(ev.timestamp));
              continue;
            }

            // Fallback: labels
            if (labels) {
              for (const key of labelKeys) {
                const entityId = labels[key];
                if (entityId && !latestByEntity.has(String(entityId))) {
                  latestByEntity.set(String(entityId), String(ev.timestamp));
                }
              }
            }
          }

          for (const [externalId, latestTs] of latestByEntity) {
            await supabase
              .from("source_entities")
              .update({ last_seen_at: latestTs, updated_at: now })
              .eq("source_id", sourceId)
              .eq("external_id", externalId)
              .eq("tenant_id", tenantId);
          }
        }
      } catch (e) {
        console.warn(`[refresh-events][${platformType}] Failed to update last_seen_at:`, e);
      }

      return NextResponse.json({
        ok: true,
        refreshed: importJson.eventsStored ?? importJson.importedCount ?? 0,
        enriched: 0,
        workflowCount: importJson.importedCount ?? 0,
        message: `Synced ${importJson.importedCount ?? 0} ${platformType} entities with ${importJson.eventsStored ?? 0} events.`,
      });
    } catch (e: any) {
      console.error(`[refresh-events][${platformType}] Unexpected error:`, e);
      return NextResponse.json(
        { ok: false, code: "REFRESH_FAILED", message: e?.message || "Unknown error" },
        { status: 500 },
      );
    }
  }

  let secret: { apiKey?: string; instanceUrl?: string; authMode?: string; method?: string };
  try {
    if (!source.secret_hash) {
      return NextResponse.json({ ok: false, code: "MISSING_SECRET" }, { status: 400 });
    }
    secret = JSON.parse(decryptSecret(source.secret_hash));
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_SECRET" }, { status: 500 });
  }

  if (!secret.apiKey) {
    return NextResponse.json({ ok: false, code: "NO_API_KEY" }, { status: 400 });
  }

  let baseUrl = secret.instanceUrl || process.env.N8N_DEFAULT_BASE_URL || "";
  baseUrl = baseUrl.replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json({ ok: false, code: "NO_INSTANCE_URL" }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  if ((secret.authMode ?? "bearer") === "header") {
    headers["X-N8N-API-KEY"] = secret.apiKey;
  } else {
    headers.Authorization = `Bearer ${secret.apiKey}`;
  }

  try {
    let workflowIds: string[] = [];

    if (workflowExternalId) {
      workflowIds = [workflowExternalId];
    } else {
      const { data: entities } = await supabase
        .from("source_entities")
        .select("external_id")
        .eq("source_id", sourceId)
        .eq("tenant_id", tenantId);

      workflowIds = (entities || []).map((e: { external_id: string }) => String(e.external_id));
    }

    if (workflowIds.length === 0) {
      return NextResponse.json({ ok: true, refreshed: 0, message: "No workflows found for this source." });
    }

    const now = new Date().toISOString();
    let totalRefreshed = 0;
    let totalEnriched = 0;

    for (const wfId of workflowIds) {
      const listUrl = `${baseUrl}/api/v1/executions?workflowId=${wfId}&limit=20`;
      const listRes = await fetch(listUrl, { method: "GET", headers });

      if (!listRes.ok) {
        console.warn(`[refresh-events] List executions failed for workflow ${wfId}: ${listRes.status}`);
        continue;
      }

      const listData = await listRes.json().catch(() => ({}));
      const executions = listData.data || listData || [];
      if (!Array.isArray(executions) || executions.length === 0) continue;

      const { data: entityRow } = await supabase
        .from("source_entities")
        .select("display_name, external_id")
        .eq("source_id", sourceId)
        .eq("external_id", wfId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const workflowName = entityRow?.display_name || wfId;

      const eventRows: any[] = [];

      for (const exec of executions.slice(0, 20)) {
        const execId = String(exec.id);
        const isError = exec.status === "error" || exec.status === "crashed";
        const startedAt = exec.startedAt || exec.createdAt || now;
        const endedAt = exec.stoppedAt || "";
        const durationMs = startedAt && endedAt
          ? Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime())
          : undefined;

        let payloadFields: Record<string, unknown> = {};

        try {
          const detailUrl = `${baseUrl}/api/v1/executions/${execId}?includeData=true`;
          const detailRes = await fetch(detailUrl, { method: "GET", headers });

          if (detailRes.ok) {
            const detailData = await detailRes.json().catch(() => ({}));
            const runData = detailData?.data?.resultData?.runData;

            if (runData && typeof runData === "object") {
              const extraction = extractPayloadFields(
                runData,
                detailData?.data?.resultData?.lastNodeExecuted,
              );
              if (extraction.fieldCount > 0) {
                payloadFields = extraction.fields;
                totalEnriched++;
              }
            }
          }
        } catch (e) {
          console.warn(`[refresh-events] Detail fetch failed for exec ${execId}:`, e);
        }

        eventRows.push({
          tenant_id: tenantId,
          source_id: sourceId,
          platform_event_id: execId,
          type: "workflow_execution",
          name: `n8n:${workflowName}:execution`,
          value: isError ? 0 : 1,
          state: {
            workflow_id: wfId,
            workflow_name: workflowName,
            execution_id: execId,
            status: isError ? "error" : "success",
            started_at: startedAt,
            ended_at: endedAt,
            duration_ms: durationMs,
            error_message: isError ? exec.data?.resultData?.error?.message || "" : undefined,
            platform: "n8n",
            ...payloadFields,
          },
          labels: {
            workflow_id: wfId,
            workflow_name: workflowName,
            execution_id: execId,
            status: isError ? "error" : "success",
            platformType: "n8n",
          },
          timestamp: startedAt,
          created_at: now,
        });
      }

      if (eventRows.length > 0) {
        const execIds = eventRows.map((r: any) => r.platform_event_id).filter(Boolean);
        if (execIds.length > 0) {
          await supabase
            .from("events")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("source_id", sourceId)
            .in("platform_event_id", execIds);
        }

        const { error: insertErr } = await supabase.from("events").insert(eventRows);

        if (insertErr) {
          console.error(`[refresh-events] Insert failed for workflow ${wfId}:`, insertErr.message);
        } else {
          totalRefreshed += eventRows.length;
        }
      }
    }

    // ── Update source_entities.last_seen_at from latest event timestamps ──
    // For each workflow that had events refreshed, find the most recent event
    // timestamp and write it back to source_entities.last_seen_at.
    if (totalRefreshed > 0) {
      try {
        // Get the latest event timestamp per external_id (workflow_id in labels)
        const { data: latestEvents } = await supabase
          .from("events")
          .select("labels, timestamp")
          .eq("tenant_id", tenantId)
          .eq("source_id", sourceId)
          .order("timestamp", { ascending: false })
          .limit(500);

        if (latestEvents && latestEvents.length > 0) {
          // Build a map of workflow_id → latest timestamp
          const latestByWorkflow = new Map<string, string>();
          for (const ev of latestEvents) {
            const wfId = (ev.labels as any)?.workflow_id;
            if (wfId && !latestByWorkflow.has(String(wfId))) {
              latestByWorkflow.set(String(wfId), String(ev.timestamp));
            }
          }

          // Update each source_entity's last_seen_at
          for (const [externalId, latestTs] of latestByWorkflow) {
            await supabase
              .from("source_entities")
              .update({
                last_seen_at: latestTs,
                updated_at: now,
              })
              .eq("source_id", sourceId)
              .eq("external_id", externalId)
              .eq("tenant_id", tenantId);
          }
        }
      } catch (e) {
        // Non-fatal — events are already stored, just log
        console.warn("[refresh-events] Failed to update last_seen_at on source_entities:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      refreshed: totalRefreshed,
      enriched: totalEnriched,
      workflowCount: workflowIds.length,
      message: `Refreshed ${totalRefreshed} events across ${workflowIds.length} workflow(s). ${totalEnriched} events contain enriched business data.`,
    });
  } catch (e: any) {
    console.error("[refresh-events] Unexpected error:", e);
    return NextResponse.json(
      { ok: false, code: "REFRESH_FAILED", message: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}
