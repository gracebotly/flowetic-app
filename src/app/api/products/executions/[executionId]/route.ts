// ============================================================================
// Level 4: Execution Polling API
// GET /api/products/executions/[executionId]
//
// Results Display polls this endpoint until status changes from
// pending/running → success/error/timeout
// ============================================================================

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;

  if (!executionId) {
    return NextResponse.json({ ok: false, code: "MISSING_EXECUTION_ID" }, { status: 400 });
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const { data: execution, error } = await supabase
    .from("workflow_executions")
    .select("id, status, mapped_results, error_message, duration_ms, completed_at, started_at")
    .eq("id", executionId)
    .maybeSingle();

  if (error || !execution) {
    return NextResponse.json({ ok: false, code: "EXECUTION_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    execution: {
      id: execution.id,
      status: execution.status,
      mapped_results: execution.mapped_results,
      error_message: execution.error_message,
      duration_ms: execution.duration_ms,
      completed_at: execution.completed_at,
      started_at: execution.started_at,
    },
  });
}
