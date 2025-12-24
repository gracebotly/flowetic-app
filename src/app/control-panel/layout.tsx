import { ControlPanelSidebar } from "@/components/layout/cp-sidebar"

export default function ControlPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ControlPanelSidebar />
      <main className="flex-1 bg-[hsl(var(--main-bg))]">
        {children}
      </main>
    </div>
  )
}