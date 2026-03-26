// ============================================================================
// Level 4: Results Page
// /p/[slug]/results/[executionId]
// ============================================================================

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ResultsDisplay } from "@/components/products/ResultsDisplay";
import { resolveBranding } from "@/lib/portals/resolveBranding";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PageProps {
  params: Promise<{ slug: string; executionId: string }>;
}

export default async function ResultsPage({ params }: PageProps) {
  const { slug, executionId } = await params;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // Load product for design tokens
  const { data: product } = await supabase
    .from("client_portals")
    .select("id, name, slug, design_tokens, tenant_id, branding")
    .eq("slug", slug)
    .maybeSingle();

  if (!product) notFound();

  // Resolve branding for footer text
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, logo_url, primary_color, secondary_color, brand_footer, welcome_message, favicon_url, default_theme")
    .eq("id", product.tenant_id)
    .single();

  const brand = resolveBranding(
    tenant ?? {},
    product.branding as Record<string, unknown> | null
  );

  // Load execution
  const { data: execution } = await supabase
    .from("workflow_executions")
    .select("id, status, mapped_results, error_message, duration_ms, started_at, completed_at")
    .eq("id", executionId)
    .eq("portal_id", product.id)
    .maybeSingle();

  if (!execution) notFound();

  const headersList = await headers();
  const isCustomDomain = !!headersList.get('x-custom-domain');

  return (
    <ResultsDisplay
      executionId={execution.id}
      initialStatus={execution.status}
      initialResults={execution.mapped_results as Record<string, unknown> | null}
      initialError={execution.error_message}
      initialDuration={execution.duration_ms}
      productName={product.name}
      productSlug={product.slug}
      designTokens={product.design_tokens as Record<string, unknown>}
      hideGetfloweticBranding={isCustomDomain}
      footerText={brand.footerText}
    />
  );
}
