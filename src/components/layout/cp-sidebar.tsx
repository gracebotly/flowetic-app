"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Users,
  LayoutDashboard,
  Zap,
  ClipboardList,
  Settings as SettingsIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }

const NAV: NavItem[] = [
  { href: "/control-panel/clients", label: "Clients", icon: Users },
  { href: "/control-panel/dashboards", label: "Dashboards", icon: LayoutDashboard },
  { href: "/control-panel/connections", label: "Connections", icon: Zap },
  { href: "/control-panel/activity", label: "Activity", icon: ClipboardList },
  { href: "/control-panel/settings", label: "Settings", icon: SettingsIcon },
]

export function ControlPanelSidebar() {
  const pathname = usePathname()
  return (
    <TooltipProvider>
      <aside
        className="flex h-screen w-22 flex-col justify-between"
        style={{ width: 88, backgroundColor: "hsl(var(--sidebar-bg))" }}
      >
        {/* Logo */}
        <div className="border-b border-white/10 p-4">
          <div className="mx-auto h-10 w-10 rounded-lg bg-blue-500 text-center text-white font-bold leading-10">GF</div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col items-stretch py-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      "mx-2 my-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 outline-none",
                      "focus-visible:ring-2 focus-visible:ring-white/40",
                      active ? "bg-blue-500 text-white" : "text-gray-400 hover:bg-white/5"
                    )}
                  >
                    <Icon size={24} className={cn(active ? "text-white" : "text-gray-300")} />
                    <span className="text-[12px] font-medium leading-4">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Profile */}
        <div className="border-t border-white/10 p-3 text-center">
          <div className="mx-auto h-8 w-8 rounded-full bg-gray-600 text-white text-[12px] font-bold leading-8">AG</div>
          <div className="mt-1 text-[10px] text-gray-400">Agency</div>
        </div>
      </aside>
    </TooltipProvider>
  )
}