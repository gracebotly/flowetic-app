"use client"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { Users } from "lucide-react"

export default function ClientsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Clients" subtitle="Manage your client accounts and health scores." />
      <EmptyState
        icon={<Users size={64} />}
        title="No clients yet"
        subtitle="Add your first client to start tracking dashboard health."
      />
    </div>
  )
}