import { createClient } from "@/lib/supabase/server"
import { ControlPanelSidebar } from "@/components/layout/cp-sidebar"

export default async function ControlPanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? "you@workspace.com"

  // You can derive plan later from billing; default Starter
  const plan = "Starter Plan"

  return (
    <div className="flex min-h-screen">
      <ControlPanelSidebar userEmail={email} plan={plan} />
      <main className="flex-1 bg-[hsl(var(--main-bg))]">
        {children}
      </main>
    </div>
  )
}