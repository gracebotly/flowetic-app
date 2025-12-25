"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLocalStorageBoolean } from "@/lib/use-local-storage"
import { AccountPopoverCard } from "./account-popover"
import {
  Users,
  LayoutDashboard,
  Zap,
  ClipboardList,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import * as Popover from "@radix-ui/react-popover"
import { useRef } from "react"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }

const NAV: NavItem[] = [
  { href: "/control-panel/clients", label: "Clients", icon: Users },
  { href: "/control-panel/dashboards", label: "Dashboards", icon: LayoutDashboard },
  { href: "/control-panel/connections", label: "Connections", icon: Zap },
  { href: "/control-panel/activity", label: "Activity", icon: ClipboardList },
  { href: "/control-panel/settings", label: "Settings", icon: SettingsIcon },
]

export function ControlPanelSidebar({ userEmail, plan }: { userEmail: string; plan: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useLocalStorageBoolean("cp_collapsed", true)
  const width = collapsed ? 88 : 240

  const NavItem = ({ href, label, Icon, active }: { href: string; label: string; Icon: any; active: boolean }) => {
    const content = (
      <Link
        href={href}
        aria-label={label}
        className={cn(
          "mx-2 my-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 outline-none",
          "focus-visible:ring-2 focus-visible:ring-white/40",
          active ? "bg-blue-500 text-white" : "text-gray-400 hover:bg-white/5"
        )}
      >
        <Icon size={24} className={cn(active ? "text-white" : "text-gray-300")} />
        {!collapsed && <span className="text-[12px] font-medium leading-4 text-center">{label}</span>}
      </Link>
    )
    return collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      content
    )
  }

  return (
    <TooltipProvider>
      <aside
        className="flex h-screen flex-col justify-between"
        style={{ width, backgroundColor: "hsl(var(--sidebar-bg))" }}
        aria-label="Control Panel Sidebar"
      >
        {/* Header */}
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500 text-center text-white font-bold leading-10">GF</div>
              {!collapsed && <div className="text-white/90 font-semibold">Getflowetic</div>}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col items-stretch py-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return <NavItem key={item.href} href={item.href} label={item.label} Icon={Icon} active={active} />
          })}
        </nav>

        {/* Profile trigger + popover */}
        <div className="border-t border-white/10 p-3">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="w-full rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                <div className="mx-auto h-8 w-8 rounded-full bg-gray-600 text-white text-[12px] font-bold leading-8">AG</div>
                {!collapsed && <div className="mt-1 text-[10px] text-gray-400">Agency</div>}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content side="right" align="end" sideOffset={12} className="z-50 outline-none">
                <AccountPopoverCard email={userEmail} plan={plan} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </aside>
    </TooltipProvider>
  )
}