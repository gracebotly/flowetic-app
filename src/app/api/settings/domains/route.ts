import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";
import { validateDomain } from "@/lib/domains/validateDomain";
import { planAllowsDomain } from "@/lib/domains/planAllowsDomain";
import { addDomain, removeDomain } from "@/lib/domains/vercelDomains";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/settings/domains ───────────────────────────────
// Returns current domain configuration. Any authenticated member can read.
export async function GET() {
  const auth = await getTenantAdmin();
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("custom_domain, domain_verified, domain_verification_data, domain_added_at, domain_verified_at, plan, plan_status, has_ever_paid")
    .eq("id", auth.tenantId)
    .single();

  if (error || !tenant) {
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  const planCheck = planAllowsDomain({
    plan: tenant.plan,
    plan_status: tenant.plan_status,
    has_ever_paid: tenant.has_ever_paid,
  });

  return json(200, {
    ok: true,
    domain: tenant.custom_domain,
    verified: tenant.domain_verified,
    verification_data: tenant.domain_verification_data,
    added_at: tenant.domain_added_at,
    verified_at: tenant.domain_verified_at,
    plan_allows_domain: planCheck.allowed,
    plan_reason: planCheck.reason ?? null,
  });
}

// ── POST /api/settings/domains ──────────────────────────────
// Add a custom domain. Admin only, paid plan only.
export async function POST(request: NextRequest) {
  // Rate limit: 5 domain add attempts per tenant per hour
  const { checkRateLimit } = await import("@/lib/api/rateLimit");

  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const limit = await checkRateLimit(`domain-add:${auth.tenantId}`, 3600, 5);
  if (!limit.allowed) {
    return json(429, {
      ok: false,
      code: "RATE_LIMITED",
      retryAfterMs: limit.reset_ms,
    });
  }

  // Parse request body
  let body: { domain?: string };
  try {
    body = (await request.json()) as { domain?: string };
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const rawDomain = body.domain;
  if (!rawDomain || typeof rawDomain !== "string") {
    return json(400, { ok: false, code: "DOMAIN_REQUIRED" });
  }

  const domain = rawDomain.trim().toLowerCase().replace(/\.$/, "");

  // 1. Validate domain format
  const validation = validateDomain(domain);
  if (!validation.valid) {
    return json(400, {
      ok: false,
      code: "INVALID_DOMAIN",
      error: validation.error,
    });
  }

  // 2. Check plan allows custom domains
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("plan, plan_status, has_ever_paid, custom_domain")
    .eq("id", auth.tenantId)
    .single();

  if (tenantError || !tenant) {
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  const planCheck = planAllowsDomain({
    plan: tenant.plan,
    plan_status: tenant.plan_status,
    has_ever_paid: tenant.has_ever_paid,
  });

  if (!planCheck.allowed) {
    return json(403, {
      ok: false,
      code: planCheck.reason ?? "PLAN_UPGRADE_REQUIRED",
    });
  }

  // 3. Check tenant doesn't already have a domain configured
  if (tenant.custom_domain) {
    return json(409, {
      ok: false,
      code: "DOMAIN_ALREADY_SET",
      error: `You already have a domain configured: ${tenant.custom_domain}. Remove it first before adding a new one.`,
    });
  }

  // 4. Check domain isn't claimed by another tenant (unique index catches this,
  //    but check first for a friendly error message)
  const { data: existing } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", auth.tenantId)
    .maybeSingle();

  if (existing) {
    return json(409, {
      ok: false,
      code: "DOMAIN_IN_USE",
      error: "This domain is already connected to another account.",
    });
  }

  // 5. Register domain with Vercel
  let vercelResult;
  try {
    vercelResult = await addDomain(domain);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown Vercel API error";
    console.error("[POST /api/settings/domains] Vercel addDomain failed:", message);

    // Check for Vercel-specific errors
    if (message.includes("already exists")) {
      return json(409, {
        ok: false,
        code: "DOMAIN_EXISTS_ON_VERCEL",
        error: "This domain is already registered on Vercel. It may belong to another project.",
      });
    }

    return json(502, {
      ok: false,
      code: "VERCEL_API_ERROR",
      error: "Failed to register domain with hosting provider. Please try again.",
    });
  }

  // 6. Store domain in tenants table.
  // ALWAYS set domain_verified = false here. Vercel's "verified" flag only
  // means ownership verification (no conflict), NOT that DNS is pointing to us.
  // Real DNS verification happens via the /verify endpoint + getDomainConfig().
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({
      custom_domain: domain,
      domain_verified: false,
      domain_verification_data: vercelResult.verification ?? null,
      domain_added_at: now,
      domain_verified_at: null,
      updated_at: now,
    })
    .eq("id", auth.tenantId);

  if (updateError) {
    console.error("[POST /api/settings/domains] DB update failed:", updateError.message);
    // Try to roll back the Vercel domain registration
    try {
      await removeDomain(domain);
    } catch {
      console.error("[POST /api/settings/domains] Rollback of Vercel domain also failed");
    }
    return json(500, { ok: false, code: "UPDATE_FAILED" });
  }

  // 7. Build DNS instructions for the UI
  const dnsInstructions = {
    type: "CNAME",
    name: domain.split(".")[0], // e.g., "portal" from "portal.smith.agency"
    value: "cname.vercel-dns.com",
  };

  return json(200, {
    ok: true,
    domain,
    verified: false,
    verification: vercelResult.verification ?? null,
    dns_instructions: dnsInstructions,
  });
}

// ── DELETE /api/settings/domains ─────────────────────────────
// Remove a custom domain. Admin only.
export async function DELETE() {
  const { checkRateLimit } = await import("@/lib/api/rateLimit");

  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const limit = await checkRateLimit(`domain-remove:${auth.tenantId}`, 3600, 5);
  if (!limit.allowed) {
    return json(429, {
      ok: false,
      code: "RATE_LIMITED",
      retryAfterMs: limit.reset_ms,
    });
  }

  // Get current domain
  const { data: tenant, error: fetchError } = await supabaseAdmin
    .from("tenants")
    .select("custom_domain")
    .eq("id", auth.tenantId)
    .single();

  if (fetchError || !tenant) {
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  if (!tenant.custom_domain) {
    return json(404, {
      ok: false,
      code: "NO_DOMAIN",
      error: "No custom domain is configured.",
    });
  }

  const domainToRemove = tenant.custom_domain;

  // Remove from Vercel
  try {
    await removeDomain(domainToRemove);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[DELETE /api/settings/domains] Vercel removeDomain failed:", message);
    // Continue with DB cleanup even if Vercel removal fails —
    // the domain may have already been removed from Vercel manually.
  }

  // Clear all domain columns in tenants table
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({
      custom_domain: null,
      domain_verified: false,
      domain_verification_data: null,
      domain_added_at: null,
      domain_verified_at: null,
      updated_at: now,
    })
    .eq("id", auth.tenantId);

  if (updateError) {
    console.error("[DELETE /api/settings/domains] DB update failed:", updateError.message);
    return json(500, { ok: false, code: "UPDATE_FAILED" });
  }

  return json(200, {
    ok: true,
    removed: domainToRemove,
  });
}
