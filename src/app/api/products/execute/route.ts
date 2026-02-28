// ============================================================================
// Level 4: Execution Proxy API
// POST /api/products/execute
//
// SECURITY: This is the most critical component. The client form NEVER
// receives the webhook URL. All execution is proxied through this route.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { resolveWebhookUrl } from "@/lib/products/resolveWebhook";
import { applyResultMapping } from "@/lib/products/resultMapper";
import type { WorkflowProduct, ExecutionConfig } from "@/lib/products/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for webhook response

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // ── Parse request ──────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const customerEmail = typeof body.email === "string" ? body.email.trim() : "";
  const customerName = typeof body.name === "string" ? body.name.trim() : "";
  const inputs = (body.inputs && typeof body.inputs === "object") ? body.inputs : {};

  if (!productId) {
    return json(400, { ok: false, code: "MISSING_PRODUCT_ID" });
  }

  // ── Load product ───────────────────────────────────────────────────────
  const { data: product, error: prodErr } = await supabase
    .from("workflow_products")
    .select("*")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (prodErr || !product) {
    return json(404, { ok: false, code: "PRODUCT_NOT_FOUND" });
  }

  const wp = product as WorkflowProduct;
  const execConfig = wp.execution_config as ExecutionConfig;

  // ── Rate limit check ───────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { count: dailyCount } = await supabase
    .from("workflow_executions")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .gte("started_at", `${today}T00:00:00Z`);

  if ((dailyCount ?? 0) >= (wp.max_runs_per_day ?? 100)) {
    return json(429, { ok: false, code: "DAILY_LIMIT_REACHED", message: "This product has reached its daily execution limit." });
  }

  // Per-customer rate limit (if email provided)
  if (customerEmail) {
    const { count: customerDailyCount } = await supabase
      .from("workflow_executions")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .gte("started_at", `${today}T00:00:00Z`)
      .contains("inputs", { _customer_email: customerEmail });

    if ((customerDailyCount ?? 0) >= (wp.max_runs_per_customer ?? 10)) {
      return json(429, { ok: false, code: "CUSTOMER_LIMIT_REACHED", message: "You have reached your daily limit for this product." });
    }
  }

  // ── Upsert customer record ─────────────────────────────────────────────
  let customerId: string | null = null;
  if (customerEmail) {
    const { data: customer } = await supabase
      .from("product_customers")
      .upsert(
        {
          product_id: productId,
          tenant_id: wp.tenant_id,
          email: customerEmail,
          name: customerName || null,
        },
        { onConflict: "product_id,email" },
      )
      .select("id")
      .single();

    customerId = customer?.id ?? null;
  }

  // ── Create execution record (pending) ──────────────────────────────────
  const executionInputs = {
    ...(inputs as Record<string, unknown>),
    _customer_email: customerEmail || undefined,
    _customer_name: customerName || undefined,
  };

  const { data: execution, error: execInsertErr } = await supabase
    .from("workflow_executions")
    .insert({
      product_id: productId,
      tenant_id: wp.tenant_id,
      customer_id: customerId,
      inputs: executionInputs,
      status: "pending",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (execInsertErr || !execution) {
    return json(500, { ok: false, code: "EXECUTION_CREATE_FAILED", message: execInsertErr?.message });
  }

  const executionId = execution.id;

  // ── Resolve webhook URL from source (NEVER exposed to client) ──────────
  let webhookInfo;
  try {
    // Load source credentials
    const { data: source } = await supabase
      .from("sources")
      .select("secret_hash")
      .eq("id", wp.source_id)
      .single();

    if (!source?.secret_hash) {
      throw new Error("No credentials found for product source.");
    }

    // Load entity metadata (may contain webhook path)
    let entityMeta: Record<string, unknown> | null = null;
    if (wp.source_entity_id) {
      const { data: entity } = await supabase
        .from("source_entities")
        .select("skill_md")
        .eq("id", wp.source_entity_id)
        .single();

      // Parse skill_md for webhook info if available
      if (entity?.skill_md) {
        try {
          entityMeta = JSON.parse(entity.skill_md);
        } catch {
          entityMeta = null;
        }
      }
    }

    webhookInfo = resolveWebhookUrl(
      execConfig.platform,
      source.secret_hash,
      entityMeta,
    );
  } catch (err) {
    // Mark execution as error
    await supabase
      .from("workflow_executions")
      .update({ status: "error", error_message: (err as Error).message, completed_at: new Date().toISOString() })
      .eq("id", executionId);

    return json(500, { ok: false, code: "WEBHOOK_RESOLVE_FAILED", executionId });
  }

  // ── Execute webhook ────────────────────────────────────────────────────
  // Mark as running
  await supabase
    .from("workflow_executions")
    .update({ status: "running" })
    .eq("id", executionId);

  const timeoutMs = execConfig.timeout_ms || 30000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const webhookResponse = await fetch(webhookInfo.url, {
      method: webhookInfo.method,
      headers: webhookInfo.headers,
      body: JSON.stringify({
        ...inputs,
        _execution_id: executionId,
        _callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/products/executions/${executionId}/callback`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text().catch(() => "Unknown error");
      await supabase
        .from("workflow_executions")
        .update({
          status: "error",
          error_message: `Webhook returned ${webhookResponse.status}: ${errorText.slice(0, 500)}`,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(execution.id).getTime(),
        })
        .eq("id", executionId);

      return json(200, { ok: true, executionId, status: "error" });
    }

    // Check if webhook returned sync response
    const contentType = webhookResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const rawOutput = await webhookResponse.json();
      const mappedResults = applyResultMapping(rawOutput, execConfig.result_mapping);
      const now = new Date().toISOString();

      await supabase
        .from("workflow_executions")
        .update({
          status: "success",
          outputs: rawOutput,
          mapped_results: mappedResults,
          completed_at: now,
          duration_ms: Date.now() - Date.parse(execution.id || now),
        })
        .eq("id", executionId);

      // Update customer usage
      if (customerId) {
        try {
          const { data: custData } = await supabase
            .from("product_customers")
            .select("total_runs")
            .eq("id", customerId)
            .single();

          await supabase
            .from("product_customers")
            .update({
              total_runs: (custData?.total_runs ?? 0) + 1,
              last_run_at: now,
            })
            .eq("id", customerId);
        } catch {
          // Non-critical — execution still succeeded
        }
      }

      return json(200, { ok: true, executionId, status: "success", mapped_results: mappedResults });
    }

    // Async workflow — webhook accepted but results come via callback
    return json(200, { ok: true, executionId, status: "pending" });

  } catch (err) {
    clearTimeout(timeoutHandle);

    const isTimeout = (err as Error).name === "AbortError";
    const status = isTimeout ? "timeout" : "error";
    const message = isTimeout
      ? `Execution timed out after ${timeoutMs}ms`
      : (err as Error).message;

    await supabase
      .from("workflow_executions")
      .update({
        status,
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    return json(200, { ok: true, executionId, status });
  }
}
