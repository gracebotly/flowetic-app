import { cn } from "@/lib/utils"
import { AlertTriangle, Circle, Phone, Zap, Cpu, Users, SlidersHorizontal } from "lucide-react"

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
  const Icon = icon === "phone" ? Phone : icon === "zap" ? Zap : icon === "cpu" ? Cpu : icon === "users" ? Users : SlidersHorizontal

  const wrapper =
    state === "error"
      ? "border-red-200 bg-red-50"
      : "border-gray-200 bg-white"

  return (
    <div className={cn("rounded-xl border p-6 transition-shadow hover:shadow-md", wrapper)}>
      <div className="flex items-start gap-4">
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
          aria-hidden
        >
          <Icon size={28} />
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
      </div>

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

      {state === "connected" && typeof todayCount === "number" ? (
        <div className="mt-4">
          <div className="text-2xl font-semibold text-gray-900">{todayCount.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Today&apos;s events</div>
        </div>
      ) : null}

      {state === "not_connected" && description ? (
        <div className="mt-3 text-xs text-gray-500">{description}</div>
      ) : null}
    </div>
  )
}