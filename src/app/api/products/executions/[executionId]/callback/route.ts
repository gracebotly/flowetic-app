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
    .select("id, portal_id, status, started_at, customer_id, tenant_id")
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
    .from("client_portals")
    .select("execution_config")
    .eq("id", execution.portal_id)
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
      .from("portal_customers")
      .select("total_runs")
      .eq("id", execution.customer_id)
      .single();

    await supabase
      .from("portal_customers")
      .update({
        total_runs: (customer?.total_runs ?? 0) + 1,
        last_run_at: now,
      })
      .eq("id", execution.customer_id);
  }

  // ── Phase 5C: Report usage for usage_based offerings ───────────────────
  if (!isError && execution.customer_id) {
    // Load offering pricing_type and meter info
    const { data: offeringData } = await supabase
      .from("client_portals")
      .select("id, tenant_id, pricing_type, stripe_meter_event_name")
      .eq("id", execution.portal_id)
      .single();

    if (offeringData?.pricing_type === "usage_based" && offeringData.stripe_meter_event_name) {
      // Load customer's Stripe ID
      const { data: customerData } = await supabase
        .from("portal_customers")
        .select("stripe_customer_id")
        .eq("id", execution.customer_id)
        .single();

      // Load tenant's Stripe account ID
      const tenantId = execution.tenant_id ?? offeringData.tenant_id;
      const { data: tenantData } = tenantId
        ? await supabase
            .from("tenants")
            .select("stripe_account_id")
            .eq("id", tenantId)
            .single()
        : { data: null };

      // Resolve tenant_id: execution may not have tenant_id directly,
      // so fall back to the offering's tenant context
      if (customerData?.stripe_customer_id && tenantData?.stripe_account_id) {
        const { reportUsageEvent } = await import("@/lib/stripe/reportUsage");
        await reportUsageEvent(
          offeringData,
          customerData.stripe_customer_id,
          tenantData.stripe_account_id,
          executionId
        );
      }
    }
  }

  return NextResponse.json({ ok: true, status: isError ? "error" : "success" });
}
