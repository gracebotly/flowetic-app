import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id, role, tenants(name, plan)')
    .eq('user_id', user?.id)
    .single()

  const tenant = membership?.tenants as any

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and workspace settings.
        </p>
      </div>

      {/* Account Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{membership?.role}</dd>
          </div>
        </dl>
      </div>

      {/* Workspace Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Workspace</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Workspace Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{tenant?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Plan</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                {tenant?.plan || 'free'}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}