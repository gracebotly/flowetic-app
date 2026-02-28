// ============================================================================
// Level 4: Execution Callback Webhook
// POST /api/products/executions/[executionId]/callback
//
// For async workflows: Make/n8n sends results to this callback URL.
// The callback URL is passed to the webhook during execution.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { applyResultMapping } from "@/lib/products/resultMapper";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;

  if (!executionId) {
    return NextResponse.json({ ok: false, code: "MISSING_EXECUTION_ID" }, { status: 400 });
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // ── Validate execution exists ──────────────────────────────────────────
  const { data: execution, error: execErr } = await supabase
    .from("workflow_executions")
    .select("id, product_id, status, started_at, customer_id")
    .eq("id", executionId)
    .maybeSingle();

  if (execErr || !execution) {
    return NextResponse.json({ ok: false, code: "EXECUTION_NOT_FOUND" }, { status: 404 });
  }

  // Ignore callbacks for already-completed executions
  if (execution.status === "success" || execution.status === "error") {
    return NextResponse.json({ ok: true, message: "Execution already completed." });
  }

  // ── Parse callback body ────────────────────────────────────────────────
  let callbackBody: Record<string, unknown>;
  try {
    callbackBody = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  const rawOutputs = callbackBody.outputs ?? callbackBody.data ?? callbackBody;
  const isError = callbackBody.error === true || callbackBody.status === "error";

  // ── Load product for result_mapping ────────────────────────────────────
  const { data: product } = await supabase
    .from("workflow_products")
    .select("execution_config")
    .eq("id", execution.product_id)
    .single();

  const resultMapping = (product?.execution_config as Record<string, unknown>)?.result_mapping as
    Record<string, string> | undefined;

  // ── Apply result mapping ───────────────────────────────────────────────
  const mappedResults = isError ? null : applyResultMapping(rawOutputs, resultMapping ?? null);

  const now = new Date().toISOString();
  const durationMs = execution.started_at
    ? Date.now() - Date.parse(execution.started_at)
    : null;

  // ── Update execution ───────────────────────────────────────────────────
  await supabase
    .from("workflow_executions")
    .update({
      status: isError ? "error" : "success",
      outputs: rawOutputs,
      mapped_results: mappedResults,
      error_message: isError ? String(callbackBody.message ?? callbackBody.error_message ?? "Workflow error") : null,
      completed_at: now,
      duration_ms: durationMs,
    })
    .eq("id", executionId);

  // ── Update customer usage ──────────────────────────────────────────────
  if (!isError && execution.customer_id) {
    const { data: customer } = await supabase
      .from("product_customers")
      .select("total_runs")
      .eq("id", execution.customer_id)
      .single();

    await supabase
      .from("product_customers")
      .update({
        total_runs: (customer?.total_runs ?? 0) + 1,
        last_run_at: now,
      })
      .eq("id", execution.customer_id);
  }

  return NextResponse.json({ ok: true, status: isError ? "error" : "success" });
}
