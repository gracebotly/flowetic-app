import { notFound } from 'next/navigation';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveBranding } from '@/lib/portals/resolveBranding';
import { ClientHubGrid } from './ClientHubGrid';
import type { Metadata } from 'next';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
  params: Promise<{ hubToken: string }>;
}

export default async function ClientHubPage({ params }: PageProps) {
  const { hubToken } = await params;

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, name, company, tenant_id')
    .eq('hub_token', hubToken)
    .single();

  if (!client) notFound();

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, logo_url, primary_color, secondary_color, brand_footer, welcome_message, custom_domain, domain_verified')
    .eq('id', client.tenant_id)
    .single();

  if (!tenant) notFound();

  const { data: portals } = await supabaseAdmin
    .from('client_portals')
    .select('id, name, token, custom_path, platform_type, skeleton_id, status, last_viewed_at, description')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .eq('access_type', 'magic_link')
    .not('token', 'is', null)
    .order('created_at', { ascending: true });

  const brand = resolveBranding(tenant, null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          {brand.logoUrl && (
            <img
              src={brand.logoUrl}
              alt={tenant.name}
              className="h-8 w-auto object-contain"
            />
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {tenant.name}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {client.company || client.name}
            </p>
          </div>
        </div>
      </header>

      {tenant.welcome_message && (
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <p className="mx-auto max-w-4xl text-sm text-slate-600">
            {tenant.welcome_message}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Your Dashboards</h1>
          <p className="mt-1 text-sm text-slate-600">
            Select a dashboard to view your latest data.
          </p>
        </div>

        <ClientHubGrid
          portals={portals ?? []}
          primaryColor={brand.primaryColor}
          useCleanUrls={Boolean(tenant?.custom_domain && tenant?.domain_verified)}
        />
      </main>

      {brand.footerText && (
        <footer className="border-t border-gray-200 px-6 py-4 text-center">
          <p className="text-xs text-slate-500">{brand.footerText}</p>
        </footer>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { hubToken } = await params;
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name, company, tenant_id')
    .eq('hub_token', hubToken)
    .single();

  if (!client) return { title: 'Dashboard Hub' };

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', client.tenant_id)
    .single();

  return {
    title: `${client.company || client.name} — ${tenant?.name ?? 'Dashboard Hub'}`,
  };
}
