// ============================================================================
// Level 4: Public Product Landing Page (Phase 2 — Premium Design)
// /products/[slug] → Glassmorphism hero + trust badges + dark mode
// Zero Getflowetic branding. Agency-branded.
// ============================================================================

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { WorkflowProduct } from '@/lib/products/types';
import { PremiumLanding } from './PremiumLanding';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // Load product
  const { data: product } = await supabase
    .from('workflow_products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!product) notFound();

  const wp = product as WorkflowProduct;

  // Load agency branding
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, logo_url, primary_color, secondary_color')
    .eq('id', wp.tenant_id)
    .single();

  // Execution count for trust badge
  const { count: totalExecutions } = await supabase
    .from('workflow_executions')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', wp.id)
    .eq('status', 'success');

  return (
    <PremiumLanding
      product={{
        id: wp.id,
        name: wp.name,
        description: wp.description,
        slug: wp.slug,
        pricingModel: wp.pricing_model,
        priceCents: wp.price_cents,
        inputSchema: (wp.input_schema as unknown[]) ?? [],
        designTokens: (wp.design_tokens as Record<string, unknown> | null) ?? null,
      }}
      branding={{
        agencyName: tenant?.name ?? 'Agency',
        logoUrl: tenant?.logo_url ?? null,
        primaryColor: tenant?.primary_color ?? '#6366f1',
        secondaryColor: tenant?.secondary_color ?? '#1e40af',
      }}
      stats={{
        totalExecutions: totalExecutions ?? 0,
      }}
    />
  );
}
