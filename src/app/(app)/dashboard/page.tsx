import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's tenant
  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user?.id)
    .single()

  const tenantId = membership?.tenant_id

  // Get counts
  const { count: interfaceCount } = await supabase
    .from('interfaces')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { count: sourceCount } = await supabase
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back! Here's an overview of your workspace.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">📊</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Interfaces
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {interfaceCount || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">🔌</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Sources
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {sourceCount || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">📈</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Events (all time)
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {eventCount || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/sources"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Source
          </a>
          <a
            href="/interfaces"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            + Create Interface
          </a>
        </div>
      </div>

      {/* Empty State / Getting Started */}
      {(sourceCount === 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900">Getting Started</h3>
          <p className="mt-2 text-sm text-blue-700">
            To start receiving data from your AI agents:
          </p>
          <ol className="mt-3 list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>Go to <strong>Sources</strong> and add your first source (Vapi, Retell, n8n, etc.)</li>
            <li>Copy the webhook URL and secret to your agent platform</li>
            <li>Watch events flow in!</li>
          </ol>
        </div>
      )}
    </div>
  )
}