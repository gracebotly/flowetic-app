import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMastra } from "@/mastra";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow workflow to run for 60 seconds

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sourceId, threadId, platformType, eventCount = 100 } = body;

    if (!sourceId || !threadId) {
      return NextResponse.json(
        { ok: false, code: "MISSING_PARAMS", message: "sourceId and threadId required" },
        { status: 400 }
      );
    }

    // Get tenant ID from membership
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { ok: false, code: "NO_MEMBERSHIP", message: "User has no tenant membership" },
        { status: 403 }
      );
    }

    const tenantId = membership.tenant_id;

    // Generate a unique run ID for tracking
    const runId = `backfill_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store initial status in database
    await supabase.from("events").insert({
      tenant_id: tenantId,
      run_id: threadId,
      type: "workflow_status",
      name: "backfill_workflow",
      text: "Workflow started",
      labels: {
        runId,
        status: "running",
        sourceId,
        platformType,
      },
      timestamp: new Date().toISOString(),
    });

    // Get Mastra instance and workflow
    const mastra = getMastra();
    const workflow = mastra.getWorkflow("connectionBackfillWorkflow");

    if (!workflow) {
      return NextResponse.json(
        { ok: false, code: "WORKFLOW_NOT_FOUND", message: "connectionBackfillWorkflow not found" },
        { status: 500 }
      );
    }

    // Start workflow asynchronously (don't await completion)
    (async () => {
      try {
        const run = await workflow.createRun();
        const result = await run.start({
          inputData: {
            tenantId,
            threadId,
            sourceId,
            platformType: platformType || "n8n",
            eventCount,
          },
        });

        // Update status on completion
        await supabase.from("events").insert({
          tenant_id: tenantId,
          run_id: threadId,
          type: "workflow_status",
          name: "backfill_workflow",
          text: result.status === "success" ? "Workflow completed" : "Workflow failed",
          labels: {
            runId,
            status: result.status,
            result: result.status === "success" ? (result as any).result : undefined,
            error: result.status === "failed" ? (result as any).error?.message : undefined,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error: unknown) {
        console.error("[Backfill Workflow Error]", error);
        // Store error status
        await supabase.from("events").insert({
          tenant_id: tenantId,
          run_id: threadId,
          type: "workflow_status",
          name: "backfill_workflow",
          text: "Workflow failed",
          labels: {
            runId,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    })();

    // Return immediately with runId
    return NextResponse.json({
      ok: true,
      runId,
      status: "started",
      message: "Workflow started successfully. Poll /api/workflows/backfill/status for updates.",
    });

  } catch (error: unknown) {
    console.error("[Start Backfill Error]", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
