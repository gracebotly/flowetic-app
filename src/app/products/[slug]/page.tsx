import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
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

  const { data: product } = await supabase
    .from('client_portals')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!product) notFound();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, logo_url, primary_color, secondary_color')
    .eq('id', product.tenant_id)
    .single();

  const { count: totalExecutions } = await supabase
    .from('workflow_executions')
    .select('id', { count: 'exact', head: true })
    .eq('portal_id', product.id)
    .eq('status', 'success');

  return (
    <PremiumLanding
      product={{
        id: product.id,
        name: product.name,
        description: product.description,
        slug: product.slug,
        surfaceType: product.surface_type ?? 'analytics',
        accessType: product.access_type ?? 'magic_link',
        pricingModel: product.pricing_type ?? 'free',
        priceCents: product.price_cents,
        token: product.token ?? null,
        inputSchema: (product.input_schema as unknown[]) ?? [],
        designTokens: (product.design_tokens as Record<string, unknown> | null) ?? null,
      }}
      branding={{
        agencyName: tenant?.name ?? 'Agency',
        logoUrl: tenant?.logo_url ?? null,
        primaryColor: tenant?.primary_color ?? '#374151',
        secondaryColor: tenant?.secondary_color ?? '#1f2937',
      }}
      stats={{
        totalExecutions: totalExecutions ?? 0,
      }}
    />
  );
}
