import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';
import { PricingGate } from '@/components/products/PricingGate';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SubscribePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const { data: product } = await supabase
    .from('client_portals')
    .select(
      'id, name, slug, token, surface_type, access_type, pricing_type, price_cents, tenant_id'
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!product) notFound();

  // Load branding
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, logo_url, primary_color')
    .eq('id', product.tenant_id)
    .single();

  // For free analytics portals with a token, redirect straight to dashboard
  if (product.pricing_type === 'free' && product.token) {
    redirect(`/client/${product.token}`);
  }

  // If arriving from Stripe success redirect with ?subscribed=true, go to dashboard
  if (query.subscribed === 'true' && product.token) {
    redirect(`/client/${product.token}`);
  }

  // Check if a specific email already has an active subscription
  let existingSubStatus: string | null = null;
  const emailParam = typeof query.email === 'string' ? query.email : null;

  if (emailParam && product.pricing_type === 'monthly') {
    const { data: customer } = await supabase
      .from('portal_customers')
      .select('subscription_status')
      .eq('portal_id', product.id)
      .eq('email', emailParam)
      .maybeSingle();

    existingSubStatus = customer?.subscription_status ?? null;

    if (existingSubStatus === 'active' && product.token) {
      redirect(`/client/${product.token}`);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-4">
          {tenant?.logo_url && (
            <img
              src={tenant.logo_url}
              alt={tenant?.name ?? 'Agency'}
              className="h-7 w-auto object-contain"
            />
          )}
          <span className="text-sm font-medium text-slate-600">
            {tenant?.name ?? 'Agency'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        <h2 className="mb-2 text-center text-lg font-semibold text-slate-900">
          {product.name}
        </h2>
        <p className="mb-8 text-center text-sm text-slate-500">
          Subscribe to access your analytics dashboard
        </p>

        <PricingGate
          offeringId={product.id}
          pricingType={product.pricing_type ?? 'free'}
          priceCents={product.price_cents ?? 0}
          slug={product.slug}
          subscriptionStatus={existingSubStatus}
          dashboardToken={product.token}
        >
          {/* This children block is for runner products — not used for analytics */}
          <div />
        </PricingGate>
      </main>
    </div>
  );
}
