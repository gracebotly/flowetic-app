import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function InterfacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user?.id)
    .single()

  const tenantId = membership?.tenant_id

  const { data: interfaces } = await supabase
    .from('interfaces')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interfaces</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your AI-generated dashboards and client portals.
          </p>
        </div>
        <Link
          href="/interfaces/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          + Create Interface
        </Link>
      </div>

      {interfaces && interfaces.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {interfaces.map((iface) => (
            <div key={iface.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  iface.status === 'published' ? 'bg-green-100 text-green-800' :
                  iface.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {iface.status}
                </span>
              </div>
              <h3 className="text-lg font-medium text-gray-900">{iface.name}</h3>
              <p className="mt-1 text-sm text-gray-500">
                Created {new Date(iface.created_at).toLocaleDateString()}
              </p>
              <div className="mt-4">
                <Link
                  href={`/interfaces/${iface.id}`}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <span className="text-5xl">📊</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No interfaces yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create your first dashboard to visualize your AI agent data.
          </p>
          <Link
            href="/interfaces/new"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            + Create Your First Interface
          </Link>
        </div>
      )}
    </div>
  )
}