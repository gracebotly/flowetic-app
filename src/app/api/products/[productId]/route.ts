// ============================================================================
// Level 4: Single Product API
// GET    /api/products/[productId] → get product details
// PATCH  /api/products/[productId] → update product
// DELETE /api/products/[productId] → archive product
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return membership?.tenant_id ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { data: product, error } = await supabase
    .from("workflow_products")
    .select("*")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !product) return json(404, { ok: false, code: "PRODUCT_NOT_FOUND" });

  return json(200, { ok: true, product });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  // Allowlisted fields for update
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.pricingModel === "string") updates.pricing_model = body.pricingModel;
  if (typeof body.priceCents === "number") updates.price_cents = body.priceCents;
  if (Array.isArray(body.inputSchema)) updates.input_schema = body.inputSchema;
  if (body.executionConfig && typeof body.executionConfig === "object") updates.execution_config = body.executionConfig;
  if (body.designTokens && typeof body.designTokens === "object") updates.design_tokens = body.designTokens;
  if (typeof body.maxRunsPerDay === "number") updates.max_runs_per_day = body.maxRunsPerDay;
  if (typeof body.maxRunsPerCustomer === "number") updates.max_runs_per_customer = body.maxRunsPerCustomer;

  if (Object.keys(updates).length === 0) {
    return json(400, { ok: false, code: "NO_FIELDS_TO_UPDATE" });
  }

  const { data: product, error } = await supabase
    .from("workflow_products")
    .update(updates)
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .select("id, name, slug, status, updated_at")
    .single();

  if (error || !product) return json(400, { ok: false, code: "UPDATE_FAILED", message: error?.message });

  return json(200, { ok: true, product });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  // Soft-delete: archive instead of hard delete
  const { error } = await supabase
    .from("workflow_products")
    .update({ status: "archived" })
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  if (error) return json(400, { ok: false, code: "ARCHIVE_FAILED", message: error.message });

  return json(200, { ok: true, message: "Product archived." });
}
