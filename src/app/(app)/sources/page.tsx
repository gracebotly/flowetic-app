import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SourcesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's tenant
  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user?.id)
    .single()

  const tenantId = membership?.tenant_id

  // Get sources
  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect your AI agent platforms to receive data.
          </p>
        </div>
        <Link
          href="/sources/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          + Add Source
        </Link>
      </div>

      {sources && sources.length > 0 ? (
        <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
          {sources.map((source) => (
            <div key={source.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className={`h-3 w-3 rounded-full ${source.status === 'active' ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{source.name}</h3>
                    <p className="text-sm text-gray-500">
                      {source.type.charAt(0).toUpperCase() + source.type.slice(1)} • Created {new Date(source.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/sources/${source.id}`}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <span className="text-5xl">📡</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No sources yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Connect your first AI agent platform to start receiving data.
          </p>
          <Link
            href="/sources/new"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Your First Source
          </Link>
        </div>
      )}
    </div>
  )
}