"use client"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { MessageSquare } from "lucide-react"

export default function ChatPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Chat"
        subtitle="Build and edit dashboards with your AI assistant."
      />
      {/* Placeholder: CopilotKit surface mounts here in next step */}
      <div className="px-8">
        <EmptyState
          icon={<MessageSquare size={64} />}
          title="Chat workspace"
          subtitle="Your AI editing surface will appear here. We'll wire CopilotKit in the next step."
        />
      </div>
    </div>
  )
}