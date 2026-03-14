"use client"

type ChangelogEntry = {
  date: string
  title: string
  description: string
  tag: "New" | "Improved" | "Fixed"
}

const TAG_STYLES: Record<string, string> = {
  New: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Improved: "bg-blue-50 text-blue-700 ring-blue-600/20",
  Fixed: "bg-amber-50 text-amber-700 ring-amber-600/20",
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "March 14, 2026",
    title: "Getflowetic is Live",
    description:
      "Connect your Vapi, Retell, n8n, or Make account and create a white-labeled client portal in under 60 seconds. Share it with your clients via magic link or charge them with Stripe. Your branding, your pricing, your clients.",
    tag: "New",
  },
  {
    date: "March 10, 2026",
    title: "Plans & Billing",
    description:
      "Subscribe to the Agency ($149/mo) or Scale ($299/mo) plan directly from Settings. Manage your subscription, view usage, and track portal limits — all from your billing dashboard.",
    tag: "New",
  },
]

export function WhatsNewTab() {
  return (
    <div className="max-w-2xl">
      <div className="space-y-0">
        {CHANGELOG.map((entry, i) => (
          <div key={i} className="relative flex gap-6 pb-8">
            {/* Timeline line */}
            {i < CHANGELOG.length - 1 && (
              <div className="absolute left-[59px] top-8 h-full w-px bg-gray-200" />
            )}

            {/* Date column */}
            <div className="w-[90px] shrink-0 pt-0.5">
              <p className="text-xs font-medium text-gray-400">
                {new Date(entry.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Timeline dot */}
            <div className="relative mt-1.5 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-white" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{entry.title}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TAG_STYLES[entry.tag]}`}
                >
                  {entry.tag}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {entry.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
