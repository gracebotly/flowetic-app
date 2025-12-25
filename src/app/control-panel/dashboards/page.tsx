"use client"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { BarChart3 } from "lucide-react"

export default function DashboardsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Dashboards" subtitle="Build and manage client dashboards." />
      <EmptyState
        icon={<BarChart3 size={64} />}
        title="No dashboards yet"
        subtitle="Create your first dashboard to visualize agent data."
      />
    </div>
  )
}