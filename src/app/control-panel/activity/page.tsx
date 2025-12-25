"use client"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { ClipboardList } from "lucide-react"

export default function ActivityPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Activity" subtitle="Monitor event stream and troubleshoot issues." />
      <EmptyState
        icon={<ClipboardList size={64} />}
        title="No activity yet"
        subtitle="Events will appear here once platforms are connected."
      />
    </div>
  )
}