"use client"

import { MetricCard } from "@/components/registry/renderer"
import { TimeseriesChart, BarChart, DataTable, Modal, TabsView, InfoAlert } from "@/components/registry/renderer"

type Row = { id: string; name: string; value: number }

const rows: Row[] = [
  { id: "1", name: "Alpha", value: 120 },
  { id: "2", name: "Beta", value: 90 },
  { id: "3", name: "Gamma", value: 160 },
]

export default function StyleGuidePage() {
  const now = new Date()
  const series = [
    {
      name: "Calls",
      data: Array.from({ length: 10 }).map((_, i) => ({
        date: new Date(now.getTime() - (9 - i) * 24 * 3600 * 1000),
        value: 50 + Math.round(Math.random() * 40),
      })),
    },
    {
      name: "Messages",
      data: Array.from({ length: 10 }).map((_, i) => ({
        date: new Date(now.getTime() - (9 - i) * 24 * 3600 * 1000),
        value: 30 + Math.round(Math.random() * 30),
      })),
    },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Style Guide</h1>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Interfaces" value={12} delta={{ value: 4, trend: "up", label: "week" }} />
        <MetricCard title="Sources" value={8} delta={{ value: -2, trend: "down", label: "week" }} />
        <MetricCard title="Events (24h)" value={5234} unit="" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TimeseriesChart series={series} />
        <BarChart series={rows.map((r) => ({ name: r.name, value: r.value }))} />
      </section>

      <section className="space-y-4">
        <DataTable<Row>
          columns={[
            { key: "name", header: "Name" },
            { key: "value", header: "Value" },
          ]}
          rows={rows}
        />
      </section>

      <section className="flex items-center gap-3">
        <Modal title="Sample Modal" description="Radix Dialog" triggerLabel="Open Modal" content={<div>Dialog body</div>} />
        <TabsView
          items={[
            { id: "a", label: "Tab A", content: <div>Content A</div> },
            { id: "b", label: "Tab B", content: <div>Content B</div> },
          ]}
        />
      </section>

      <section className="space-y-3">
        <InfoAlert title="Default alert" />
        <InfoAlert title="Success!" severity="success" description="Everything looks good." />
        <InfoAlert title="Heads up" severity="warning" description="This is a warning." />
        <InfoAlert title="Error" severity="danger" description="Something went wrong." />
      </section>
    </div>
  )
}