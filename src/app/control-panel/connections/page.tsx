"use client"

import { PageHeader } from "@/components/layout/page-header"
import { PlatformCard } from "@/components/platform-card"

export default function ConnectionsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Connections"
        subtitle="Connect your AI platforms to start ingesting events."
      />
      <section className="px-8 py-8">
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {/* Vapi (Connected) */}
          <PlatformCard
            title="Vapi"
            subtitle="Voice agent platform"
            state="connected"
            icon="phone"
            colors={{ bg: "#dbeafe", fg: "#1d4ed8" }}
            lastEventText="Last event: 2m ago"
            todayCount={1247}
          />
          {/* Retell (Error) */}
          <PlatformCard
            title="Retell"
            subtitle="Voice agent platform"
            state="error"
            icon="phone"
            colors={{ bg: "#fee2e2", fg: "#dc2626" }}
          />
          {/* n8n (Not Connected) */}
          <PlatformCard
            title="n8n"
            subtitle="Workflow automation"
            state="not_connected"
            icon="zap"
            colors={{ bg: "#fef3c7", fg: "#d97706" }}
            description="Connect to start receiving workflow events..."
          />
          {/* Mastra (Not Connected) */}
          <PlatformCard
            title="Mastra"
            subtitle="AI orchestration framework"
            state="not_connected"
            icon="cpu"
            colors={{ bg: "#ede9fe", fg: "#7c3aed" }}
          />
          {/* CrewAI (Not Connected) */}
          <PlatformCard
            title="CrewAI"
            subtitle="Multi-agent runtime"
            state="not_connected"
            icon="users"
            colors={{ bg: "#e0e7ff", fg: "#4f46e5" }}
          />
          {/* Pydantic AI (Not Connected) */}
          <PlatformCard
            title="Pydantic AI"
            subtitle="Typed AI workflow framework"
            state="not_connected"
            icon="sliders"
            colors={{ bg: "#d1fae5", fg: "#059669" }}
          />
        </div>
      </section>
    </div>
  )
}