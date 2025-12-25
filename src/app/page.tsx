import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
 
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
 
  // If logged in, redirect to the new Control Panel shell by default
  if (user) {
    redirect('/control-panel/connections')
  }
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900">
            Getflowetic
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Turn your AI agent data into beautiful, real-time dashboards in minutes.
            Built for AI automation agencies.
          </p>
          <div className="mt-8 flex justify-center space-x-4">
            <Link
              href="/signup"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
