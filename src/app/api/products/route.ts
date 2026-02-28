// ============================================================================
// Level 4: Products CRUD API
// GET  /api/products → list products for tenant
// POST /api/products → create new product
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSlug, appendSlugSuffix } from "@/lib/products/slugUtils";
import type { InputField, ExecutionConfig } from "@/lib/products/types";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET: List products for tenant ────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return json(403, { ok: false, code: "TENANT_ACCESS_DENIED" });

  const { data: products, error } = await supabase
    .from("workflow_products")
    .select(`
      id, name, description, slug, status, pricing_model, price_cents,
      max_runs_per_day, created_at, updated_at,
      source_entities!source_entity_id ( display_name, entity_kind )
    `)
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  if (error) return json(500, { ok: false, code: "QUERY_FAILED", message: error.message });

  // Get execution counts per product
  const productIds = (products ?? []).map((p: any) => p.id);
  const { data: execCounts } = await supabase
    .from("workflow_executions")
    .select("product_id, status")
    .in("product_id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);

  const countMap: Record<string, { total: number; success: number }> = {};
  for (const ex of execCounts ?? []) {
    const pid = ex.product_id as string;
    if (!countMap[pid]) countMap[pid] = { total: 0, success: 0 };
    countMap[pid].total++;
    if (ex.status === "success") countMap[pid].success++;
  }

  const enriched = (products ?? []).map((p: any) => ({
    ...p,
    execution_stats: countMap[p.id] ?? { total: 0, success: 0 },
  }));

  return json(200, { ok: true, products: enriched });
}

// ── POST: Create new product ─────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return json(403, { ok: false, code: "TENANT_ACCESS_DENIED" });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const sourceEntityId = typeof body.sourceEntityId === "string" ? body.sourceEntityId : null;
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : null;
  const pricingModel = typeof body.pricingModel === "string" ? body.pricingModel : "free";
  const priceCents = typeof body.priceCents === "number" ? body.priceCents : 0;
  const inputSchema = Array.isArray(body.inputSchema) ? body.inputSchema as InputField[] : [];
  const executionConfig = (body.executionConfig && typeof body.executionConfig === "object")
    ? body.executionConfig as ExecutionConfig
    : { platform: "make" as const, timeout_ms: 30000, result_mapping: {} };
  const designTokens = (body.designTokens && typeof body.designTokens === "object")
    ? body.designTokens
    : {};
  const maxRunsPerDay = typeof body.maxRunsPerDay === "number" ? body.maxRunsPerDay : 100;
  const maxRunsPerCustomer = typeof body.maxRunsPerCustomer === "number" ? body.maxRunsPerCustomer : 10;

  if (!name) return json(400, { ok: false, code: "MISSING_NAME" });

  // Generate unique slug
  let slug = generateSlug(name);
  let slugAttempt = 0;
  while (true) {
    const candidate = slugAttempt === 0 ? slug : appendSlugSuffix(slug, slugAttempt);
    const { data: existing } = await supabase
      .from("workflow_products")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("slug", candidate)
      .maybeSingle();

    if (!existing) {
      slug = candidate;
      break;
    }
    slugAttempt++;
    if (slugAttempt > 20) {
      slug = `${slug}-${Date.now().toString(36)}`;
      break;
    }
  }

  // Verify source belongs to tenant (if provided)
  if (sourceId) {
    const { data: source } = await supabase
      .from("sources")
      .select("id")
      .eq("id", sourceId)
      .eq("tenant_id", membership.tenant_id)
      .maybeSingle();

    if (!source) return json(400, { ok: false, code: "SOURCE_NOT_FOUND" });
  }

  const { data: product, error: insertErr } = await supabase
    .from("workflow_products")
    .insert({
      tenant_id: membership.tenant_id,
      source_entity_id: sourceEntityId,
      source_id: sourceId,
      name,
      description,
      slug,
      pricing_model: pricingModel,
      price_cents: priceCents,
      input_schema: inputSchema,
      execution_config: executionConfig,
      design_tokens: designTokens,
      status: "draft",
      max_runs_per_day: maxRunsPerDay,
      max_runs_per_customer: maxRunsPerCustomer,
    })
    .select("id, slug, status, created_at")
    .single();

  if (insertErr || !product) {
    return json(500, { ok: false, code: "CREATE_FAILED", message: insertErr?.message });
  }

  return json(201, { ok: true, product });
}
