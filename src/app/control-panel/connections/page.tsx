"use client"

import { useMemo, useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { PlatformCard } from "@/components/platform-card"

type Status = "all" | "connected" | "not_connected" | "error"

export default function ConnectionsPage() {
  const [status, setStatus] = useState<Status>("all")

  const platforms = useMemo(
    () => [
      {
        key: "vapi",
        title: "Vapi" as const,
        subtitle: "Voice agent platform",
        state: "connected" as const,
        icon: "phone" as const,
        colors: { bg: "#dbeafe", fg: "#1d4ed8" },
        lastEventText: "Last event: 2m ago",
        todayCount: 1247,
      },
      {
        key: "retell",
        title: "Retell" as const,
        subtitle: "Voice agent platform",
        state: "error" as const,
        icon: "phone" as const,
        colors: { bg: "#fee2e2", fg: "#dc2626" },
      },
      {
        key: "n8n",
        title: "n8n" as const,
        subtitle: "Workflow automation",
        state: "not_connected" as const,
        icon: "zap" as const,
        colors: { bg: "#fef3c7", fg: "#d97706" },
        description: "Connect to start receiving workflow events and automation data.",
      },
      {
        key: "mastra",
        title: "Mastra" as const,
        subtitle: "AI orchestration framework",
        state: "not_connected" as const,
        icon: "cpu" as const,
        colors: { bg: "#ede9fe", fg: "#7c3aed" },
      },
      {
        key: "crewai",
        title: "CrewAI" as const,
        subtitle: "Multi-agent runtime",
        state: "not_connected" as const,
        icon: "users" as const,
        colors: { bg: "#e0e7ff", fg: "#4f46e5" },
      },
      {
        key: "pydantic",
        title: "Pydantic AI" as const,
        subtitle: "Typed AI workflow framework",
        state: "not_connected" as const,
        icon: "sliders" as const,
        colors: { bg: "#d1fae5", fg: "#059669" },
      },
    ],
    []
  )

  const filtered = platforms.filter((p) => (status === "all" ? true : p.state === status))

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Connections"
        subtitle="Connect your AI platforms to start ingesting events."
        rightSlot={
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Connect Platform
          </button>
        }
      />

      {/* Filter chips */}
      <section className="px-8 pt-6">
        <div className="flex flex-wrap gap-3">
          {[
            { key: "all", label: "All" },
            { key: "connected", label: "Connected" },
            { key: "not_connected", label: "Not connected" },
            { key: "error", label: "Error" },
          ].map((f) => {
            const active = status === (f.key as Status)
            return (
              <button
                key={f.key}
                onClick={() => setStatus(f.key as Status)}
                className={
                  active
                    ? "rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                }
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Grid */}
      <section className="px-8 py-8">
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {filtered.map((p) => (
            <PlatformCard key={p.key} {...p} />
          ))}
        </div>
      </section>
    </div>
  )
}