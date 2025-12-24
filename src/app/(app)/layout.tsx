import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LogoutButton } from "@/components/logout-button"
 
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
 
  if (!user) {
    redirect('/login')
  }
 
  // Get user's tenant
  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id, tenants(name)')
    .eq('user_id', user.id)
    .single()
 
  const tenantName = (membership?.tenants as any)?.name || 'My Workspace'
 
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-blue-600">
                  Getflowetic
                </Link>
              </div>
               
              {/* Navigation Links */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-gray-300"
                >
                  🏠 Dashboard
                </Link>
                <Link
                  href="/interfaces"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:border-gray-300 hover:text-gray-700"
                >
                  📊 Interfaces
                </Link>
                <Link
                  href="/sources"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:border-gray-300 hover:text-gray-700"
                >
                  🔌 Sources
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:border-gray-300 hover:text-gray-700"
                >
                  ⚙️ Settings
                </Link>
                {/* New: Control Panel entry to the new shell */}
                <Link
                  href="/control-panel/connections"
                  className="inline-flex items-center px-2 py-1 ml-4 rounded-md bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
                >
                  Control Panel
                </Link>
              </div>
            </div>
             
            {/* Right side */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{tenantName}</span>
              <span className="text-sm text-gray-700">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>
 
      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}