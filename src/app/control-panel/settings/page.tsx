"use client"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Settings" subtitle="Manage branding, team, and account settings." />
      <EmptyState
        icon={<Settings size={64} />}
        title="Settings"
        subtitle="Configuration options coming soon."
      />
    </div>
  )
}