"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLocalStorageBoolean } from "@/lib/use-local-storage"
import { AccountCardPanel } from "./account-popover"
import {
  Users,
  LayoutDashboard,
  Zap,
  ClipboardList,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  User,
} from "lucide-react"
import * as Popover from "@radix-ui/react-popover"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }

const NAV: NavItem[] = [
  { href: "/control-panel/connections", label: "Connections", icon: Zap },
  { href: "/control-panel/client-portals", label: "Client Portals", icon: LayoutDashboard },
  { href: "/control-panel/revenue", label: "Revenue", icon: DollarSign },
  { href: "/control-panel/clients", label: "Clients", icon: Users },
  { href: "/control-panel/activity", label: "Activity", icon: ClipboardList },
  { href: "/control-panel/settings", label: "Settings", icon: SettingsIcon },
]

interface SidebarProps {
  userEmail: string
  plan: string
  tenantName: string
  tenantLogoUrl: string | null
  tenantColor: string
}

export function ControlPanelSidebar({
  userEmail,
  plan,
  tenantName,
  tenantLogoUrl,
  tenantColor,
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useLocalStorageBoolean("cp_collapsed", true)

  // ── Settings badge: warn if branding incomplete ───────────
  const [settingsBadge, setSettingsBadge] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/settings/branding")
        const json = await res.json()
        if (!active) return
        if (json.ok && json.branding) {
          const b = json.branding
          const incomplete =
            !b.logo_url ||
            b.primary_color === "#059669" ||
            !b.brand_footer ||
            b.brand_footer === "Powered by Getflowetic"
          setSettingsBadge(incomplete)
        }
      } catch {}
    })()
    return () => {
      active = false
    }
  }, [])

  const width = collapsed ? 64 : 120

  // Tenant initial for fallback logo
  const tenantInitial = tenantName?.charAt(0)?.toUpperCase() || "W"

  const NavEntry = ({ href, label, Icon, active, badge }: { href: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; active: boolean; badge?: boolean }) => {
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
        <div className="relative">
          <Icon size={22} className={cn(active ? "text-white" : "text-gray-300")} />
          {badge && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[hsl(var(--sidebar-bg))]" />
          )}
        </div>
        {!collapsed && <span className="text-[11px] font-medium leading-4 text-center">{label}</span>}
      </Link>
    )
    return collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{base}</TooltipTrigger>
        <TooltipContent side="right">{label}{badge ? " (setup incomplete)" : ""}</TooltipContent>
      </Tooltip>
    ) : (
      base
    )
  }

  return (
    <TooltipProvider>
      <aside
        className="sticky top-0 flex h-screen flex-col justify-between"
        style={{ width, backgroundColor: "hsl(var(--sidebar-bg))" }}
        aria-label="Control Panel Sidebar"
      >
        {/* Header: tenant logo + toggle */}
        <div className="border-b border-white/10 p-2">
          <div className="flex items-center justify-between">
            {tenantLogoUrl ? (
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={tenantLogoUrl}
                  alt={tenantName || "Workspace"}
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: tenantColor }}
              >
                {tenantInitial}
              </div>
            )}
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
        <nav className="flex flex-1 flex-col items-stretch overflow-y-auto py-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            const badge = item.label === "Settings" ? settingsBadge : false
            return <NavEntry key={item.href} href={item.href} label={item.label} Icon={Icon} active={active} badge={badge} />
          })}
        </nav>

        {/* Bottom: user icon + popover */}
        <div className="border-t border-white/10 p-2">
          <Popover.Root>
            <Popover.Trigger
              className="w-full rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Open account menu"
            >
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gray-600">
                <User size={14} className="text-gray-300" />
              </div>
              {!collapsed && <div className="mt-1 truncate text-[11px] font-medium leading-tight text-gray-400">{tenantName || "Account"}</div>}
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content side="right" align="end" sideOffset={12} className="z-50 outline-none">
                <AccountCardPanel
                  email={userEmail}
                  plan={plan}
                  tenantName={tenantName}
                  tenantColor={tenantColor}
                  tenantLogoUrl={tenantLogoUrl}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </aside>
    </TooltipProvider>
  )
}
