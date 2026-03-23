import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";
import { verifyDomain, getDomainConfig } from "@/lib/domains/vercelDomains";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/settings/domains/verify ────────────────────────
// Check DNS verification status against Vercel API.
// Updates tenant record if newly verified.
// Rate limited: 30 per hour per tenant (polling every 30s = 120/hr,
// but the UI only polls for a few minutes at a time).
export async function GET() {
  const { checkRateLimit } = await import("@/lib/api/rateLimit");

  const auth = await getTenantAdmin();
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const limit = await checkRateLimit(`domain-verify:${auth.tenantId}`, 3600, 30);
  if (!limit.allowed) {
    return json(429, {
      ok: false,
      code: "RATE_LIMITED",
      retryAfterMs: limit.reset_ms,
    });
  }

  // Get current domain from tenant
  const { data: tenant, error: fetchError } = await supabaseAdmin
    .from("tenants")
    .select("custom_domain, domain_verified")
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

  // If already verified, just check if DNS config is still good
  if (tenant.domain_verified) {
    let misconfigured = false;
    try {
      const config = await getDomainConfig(tenant.custom_domain);
      misconfigured = config.misconfigured;
    } catch {
      // getDomainConfig can fail for subdomains — not critical
    }

    return json(200, {
      ok: true,
      domain: tenant.custom_domain,
      verified: true,
      ssl_active: !misconfigured,
    });
  }

  // Domain is not yet verified — ask Vercel to re-check
  let vercelResult;
  try {
    vercelResult = await verifyDomain(tenant.custom_domain);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GET /api/settings/domains/verify] Vercel verify failed:", message);
    return json(502, {
      ok: false,
      code: "VERCEL_API_ERROR",
      error: "Failed to check verification status. Please try again.",
    });
  }

  // If Vercel now reports verified, update our DB
  if (vercelResult.verified) {
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("tenants")
      .update({
        domain_verified: true,
        domain_verified_at: now,
        updated_at: now,
      })
      .eq("id", auth.tenantId);

    if (updateError) {
      console.error("[GET /api/settings/domains/verify] DB update failed:", updateError.message);
      // Don't fail the response — the verification succeeded even if DB update didn't
    }

    // Check SSL/DNS config
    let sslActive = true;
    try {
      const config = await getDomainConfig(tenant.custom_domain);
      sslActive = !config.misconfigured;
    } catch {
      // Not critical
    }

    return json(200, {
      ok: true,
      domain: tenant.custom_domain,
      verified: true,
      ssl_active: sslActive,
    });
  }

  // Still not verified
  return json(200, {
    ok: true,
    domain: tenant.custom_domain,
    verified: false,
    ssl_active: false,
  });
}
