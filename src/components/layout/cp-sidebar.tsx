"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLocalStorageBoolean } from "@/lib/use-local-storage"
import { AccountCardPanel } from "./account-popover"
import {
  MessageSquare,
  Users,
  LayoutDashboard,
  Zap,
  ClipboardList,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import * as Popover from "@radix-ui/react-popover"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }

const NAV: NavItem[] = [
  { href: "/control-panel/connections", label: "Connections", icon: Zap },
  { href: "/control-panel/chat", label: "Chat", icon: MessageSquare },
  { href: "/control-panel/projects", label: "Projects", icon: LayoutDashboard },
  { href: "/control-panel/clients", label: "Clients", icon: Users },
  { href: "/control-panel/activity", label: "Activity", icon: ClipboardList },
  { href: "/control-panel/settings", label: "Settings", icon: SettingsIcon },
]

export function ControlPanelSidebar({ userEmail, plan }: { userEmail: string; plan: string }) {
  const pathname = usePathname()
  // collapsed = true -> 64px icons-only; false -> 120px icons + tiny labels
  const [collapsed, setCollapsed] = useLocalStorageBoolean("cp_collapsed", true)

  const width = collapsed ? 64 : 120

  const NavEntry = ({ href, label, Icon, active }: { href: string; label: string; Icon: any; active: boolean }) => {
    const base = (
      <Link
        href={href}
        aria-label={label}
        className={cn(
          "mx-1 my-1 flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 outline-none",
          "focus-visible:ring-2 focus-visible:ring-white/40",
          active ? "bg-blue-500 text-white" : "text-gray-400 hover:bg-white/5"
        )}
      >
        <Icon size={22} className={cn(active ? "text-white" : "text-gray-300")} />
        {!collapsed && <span className="text-[11px] font-medium leading-4 text-center">{label}</span>}
      </Link>
    )
    // Tooltips only when collapsed
    return collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{base}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      base
    )
  }

  return (
    <TooltipProvider>
      <aside
        className="flex h-screen flex-col justify-between"
        style={{ width, backgroundColor: "hsl(var(--sidebar-bg))" }}
        aria-label="Control Panel Sidebar"
      >
        {/* Header: icon only (no brand text) + toggle */}
        <div className="border-b border-white/10 p-2">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-lg bg-blue-500 text-center text-white font-bold leading-9">GF</div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col items-stretch py-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return <NavEntry key={item.href} href={item.href} label={item.label} Icon={Icon} active={active} />
          })}
        </nav>

        {/* Bottom avatar trigger and working popover */}
        <div className="border-t border-white/10 p-2">
          <Popover.Root>
            {/* Use Popover.Trigger directly (not asChild) to avoid event swallowing */}
            <Popover.Trigger
              className="w-full rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Open account menu"
            >
              <div className="mx-auto h-8 w-8 rounded-full bg-gray-600 text-white text-[12px] font-bold leading-8">AG</div>
              {!collapsed && <div className="mt-1 text-[10px] text-gray-400">Agency</div>}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content side="right" align="end" sideOffset={12} className="z-50 outline-none">
                <AccountCardPanel email={userEmail} plan={plan} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </aside>
    </TooltipProvider>
  )
}