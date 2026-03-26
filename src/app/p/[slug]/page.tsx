import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { PremiumLanding } from './PremiumLanding';
import { getPortalBaseUrl } from '@/lib/domains/getPortalBaseUrl';
import { resolveBranding } from '@/lib/portals/resolveBranding';
import type { Metadata } from 'next';

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
    .select('name, logo_url, primary_color, secondary_color, custom_domain, domain_verified, brand_footer, welcome_message, favicon_url, default_theme')
    .eq('id', product.tenant_id)
    .single();

  // Detect if this request is being served on a custom domain
  const headersList = await headers();
  const isCustomDomain = !!headersList.get('x-custom-domain');

  const { count: totalExecutions } = await supabase
    .from('workflow_executions')
    .select('id', { count: 'exact', head: true })
    .eq('portal_id', product.id)
    .eq('status', 'success');

  // Resolve branding through 3-tier cascade (platform defaults → tenant → portal override)
  const brand = resolveBranding(
    tenant ?? {},
    product.branding as Record<string, unknown> | null
  );

  return (
    <PremiumLanding
      hideGetfloweticBranding={isCustomDomain}
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
        logoUrl: brand.logoUrl,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        footerText: brand.footerText,
      }}
      stats={{
        totalExecutions: totalExecutions ?? 0,
      }}
    />
  );
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const { data: product } = await supabase
    .from('client_portals')
    .select('name, description, tenant_id')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!product) {
    return { title: 'Product Not Found' };
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, custom_domain, domain_verified')
    .eq('id', product.tenant_id)
    .single();

  const baseUrl = getPortalBaseUrl({
    custom_domain: tenant?.custom_domain ?? null,
    domain_verified: tenant?.domain_verified ?? false,
  });
  const canonicalUrl = `${baseUrl}/p/${slug}`;

  return {
    title: `${product.name} — ${tenant?.name ?? 'Product'}`,
    description: product.description || `AI-powered product by ${tenant?.name ?? 'Agency'}`,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}
