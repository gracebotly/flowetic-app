import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { ok: false, code: "MISSING_RUN_ID", message: "runId query parameter required" },
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

    // Query for workflow status events
    const { data: statusEvents, error: queryError } = await supabase
      .from("events")
      .select("*")
      .eq("tenant_id", membership.tenant_id)
      .eq("type", "workflow_status")
      .eq("name", "backfill_workflow")
      .contains("labels", { runId })
      .order("timestamp", { ascending: false })
      .limit(1);

    if (queryError) {
      return NextResponse.json(
        { ok: false, code: "QUERY_ERROR", message: queryError.message },
        { status: 500 }
      );
    }

    if (!statusEvents || statusEvents.length === 0) {
      return NextResponse.json(
        { ok: false, code: "RUN_NOT_FOUND", message: `Workflow run ${runId} not found` },
        { status: 404 }
      );
    }

    const latestStatus = statusEvents[0];
    const labels = latestStatus.labels as any;
    const status = labels?.status;

    // Map status to response
    if (status === "success") {
      return NextResponse.json({
        ok: true,
        status: "complete",
        runId,
        result: labels?.result,
        message: "Workflow completed successfully",
      });
    }

    if (status === "failed") {
      return NextResponse.json({
        ok: false,
        status: "failed",
        runId,
        error: labels?.error || "Workflow failed",
        message: "Workflow execution failed",
      });
    }

    if (status === "running") {
      return NextResponse.json({
        ok: true,
        status: "running",
        runId,
        message: "Workflow is still running",
      });
    }

    // Handle other statuses
    return NextResponse.json({
      ok: true,
      status: status || "unknown",
      runId,
      message: `Workflow status: ${status || "unknown"}`,
    });

  } catch (error: unknown) {
    console.error("[Backfill Status Error]", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
