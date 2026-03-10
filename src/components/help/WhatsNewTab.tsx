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
    date: "March 2, 2026",
    title: "Help & Updates Page",
    description:
      "New Help page with changelog, learning resources, and a contact form. Access it from the account menu in the sidebar.",
    tag: "New",
  },
  {
    date: "March 1, 2026",
    title: "Client Health Scores",
    description:
      "Clients now have a computed health score (0–100) based on engagement recency, portal views, and portal coverage. Visible on the client list and detail pages.",
    tag: "New",
  },
  {
    date: "February 28, 2026",
    title: "Settings Tab Overhaul",
    description:
      "Redesigned Settings with five sub-tabs: Workspace, Branding, Billing, Team, and Danger Zone. Upload logos, pick brand colors, and manage your team.",
    tag: "Improved",
  },
  {
    date: "February 26, 2026",
    title: "Unified Client Portals",
    description:
      "Portals and Products have been merged into a single Client Portals tab. One creation wizard handles analytics dashboards, workflow tools, and form-based products.",
    tag: "Improved",
  },
  {
    date: "February 20, 2026",
    title: "Client Management Tab",
    description:
      "Full CRM-style client management with health scores, portal assignment, magic link access, and client-scoped activity feeds.",
    tag: "New",
  },
  {
    date: "February 10, 2026",
    title: "Connection Wizard Improvements",
    description:
      "Fixed credential validation for n8n and Make connections. Added clearer error messages and a guided setup flow.",
    tag: "Fixed",
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
