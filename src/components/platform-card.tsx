"use client"

import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Circle,
  Phone,
  Zap,
  Cpu,
  Users,
  SlidersHorizontal,
  MoreHorizontal,
} from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

type State = "connected" | "error" | "not_connected"

export function PlatformCard({
  title,
  subtitle,
  state,
  icon,
  colors,
  lastEventText,
  todayCount,
  description,
}: {
  title: "Vapi" | "Retell" | "n8n" | "Mastra" | "CrewAI" | "Pydantic AI"
  subtitle: string
  state: State
  icon: "phone" | "zap" | "cpu" | "users" | "sliders"
  colors: { bg: string; fg: string }
  lastEventText?: string
  todayCount?: number
  description?: string
}) {
  const Icon =
    icon === "phone" ? Phone : icon === "zap" ? Zap : icon === "cpu" ? Cpu : icon === "users" ? Users : SlidersHorizontal

  const wrapper =
    state === "error" ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"

  return (
    <div className={cn("rounded-xl border p-6 transition-shadow hover:shadow-md", wrapper)}>
      {/* Top row: icon + title + kebab */}
      <div className="flex items-start gap-4">
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
          aria-hidden
        >
          <Icon size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500">{subtitle}</div>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="h-8 w-8 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
              aria-label="More actions"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="bottom" align="end" className="z-50 min-w-[160px] rounded-md border bg-white p-1 shadow">
              <DropdownMenu.Item className="rounded px-2 py-1.5 text-sm hover:bg-gray-100">View Activity</DropdownMenu.Item>
              <DropdownMenu.Item className="rounded px-2 py-1.5 text-sm hover:bg-gray-100">Rotate Secret</DropdownMenu.Item>
              <DropdownMenu.Item className="rounded px-2 py-1.5 text-sm hover:bg-gray-100">Disconnect</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Status */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        {state === "error" ? (
          <>
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-red-700 font-medium">Attention needed</span>
            <span className="text-red-600">• See details</span>
          </>
        ) : state === "connected" ? (
          <>
            <Circle className="h-3 w-3 text-green-500 fill-green-500" />
            <span className="text-gray-700">Connected</span>
            {lastEventText ? <span className="text-gray-500">• {lastEventText}</span> : null}
          </>
        ) : (
          <>
            <Circle className="h-3 w-3 text-gray-400 fill-gray-400" />
            <span className="text-gray-600">Not connected</span>
          </>
        )}
      </div>

      {/* Details / stats / description */}
      {state === "connected" && typeof todayCount === "number" ? (
        <div className="mt-4">
          <div className="text-2xl font-semibold text-gray-900">{todayCount.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Today&apos;s events</div>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="mt-2 text-xs text-red-700">Last successful event: 3h ago</div>
      ) : null}

      {state === "not_connected" && description ? (
        <div className="mt-3 text-xs text-gray-500">{description}</div>
      ) : null}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-3">
        {state === "connected" ? (
          <>
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              View Details
            </button>
            <button className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200">
              View Activity
            </button>
          </>
        ) : state === "error" ? (
          <>
            <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Troubleshoot
            </button>
            <button className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200">
              View Activity
            </button>
          </>
        ) : (
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Connect
          </button>
        )}
      </div>
    </div>
  )
}