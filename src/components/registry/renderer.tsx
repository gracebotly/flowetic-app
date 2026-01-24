"use client"

import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Alert as AlertBox } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { AreaChart, BarChart as TremorBar } from "@tremor/react"
import { useMemo } from "react"
import type {
  AlertProps,
  BarChartProps,
  DataTableProps,
  MetricCardProps,
  ModalProps,
  TabsProps,
  TimeseriesChartProps,
} from "./types"

// MetricCard → Tremor Card + shadcn Card hybrid
export function MetricCard({ title, value, unit, delta, icon }: MetricCardProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardContent>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-3xl font-semibold">{value}</div>
          {unit ? <div className="text-sm text-foreground/70">{unit}</div> : null}
          {icon ? <div className="ml-auto text-2xl">{icon}</div> : null}
        </div>
        {delta ? (
          <div className="mt-2 text-xs">
            <span
              className={
                delta.trend === "up"
                  ? "text-green-600"
                  : delta.trend === "down"
                  ? "text-red-600"
                  : "text-foreground/60"
              }
            >
              {delta.value > 0 ? "+" : ""}
              {delta.value}%
            </span>{" "}
            <span className="text-foreground/60">{delta.label ?? "vs. previous"}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// TimeseriesChart → Tremor AreaChart
export function TimeseriesChart({ series }: TimeseriesChartProps) {
  const data = useMemo(() => {
    // Merge into one array with keys per series
    const map = new Map<string, Record<string, any>>()
    for (const s of series) {
      for (const { date, value } of s.data) {
        const k = typeof date === "string" ? date : date.toISOString()
        if (!map.has(k)) map.set(k, { date: k })
        map.get(k)![s.name] = value
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [series])

  const categories = series.map((s) => s.name)
  return (
    <Card>
      <CardTitle>Timeseries</CardTitle>
      <CardContent>
        <AreaChart
          className="h-64"
          data={data}
          index="date"
          categories={categories}
          colors={["blue", "violet", "emerald", "rose", "amber"]}
          valueFormatter={(n: any) => Intl.NumberFormat("en-US").format(Number(n))}
        />
      </CardContent>
    </Card>
  )
}

// BarChart → Tremor BarChart
export function BarChart({ series }: BarChartProps) {
  const data = series.map((s) => ({ name: s.name, value: s.value }))
  return (
    <Card>
      <CardTitle>BarChart</CardTitle>
      <CardContent>
        <TremorBar
          className="h-64"
          data={data}
          index="name"
          categories={["value"]}
          colors={["blue"]}
          valueFormatter={(n: any) => Intl.NumberFormat("en-US").format(Number(n))}
        />
      </CardContent>
    </Card>
  )
}

// DataTable → TanStack + shadcn Table
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from "@tanstack/react-table"
export function DataTable<T extends object>({ columns, rows }: DataTableProps<T>) {
  const defs = useMemo<ColumnDef<T, any>[]>(
    () =>
      columns.map((c) => ({
        header: c.header,
        accessorKey: c.key as string,
        cell: ({ row }: any) => (c.cell ? c.cell(row.original) : (row.original as any)[c.key]),
      })),
    [columns]
  )

  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel() })

  return (
    <Card>
      <CardTitle>Data Table</CardTitle>
      <CardContent>
        <Table>
          <THead>
            {table.getHeaderGroups().map((hg: any) => (
              <TR key={hg.id}>
                {hg.headers.map((h: any) => (
                  <TH key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TH>
                ))}
              </TR>
            ))}
          </THead>
          <TBody>
            {table.getRowModel().rows.map((r: any) => (
              <TR key={r.id}>
                {r.getVisibleCells().map((c: any) => (
                  <TD key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Modal → Radix Dialog
export function Modal({ title, description, triggerLabel, content }: ModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <div>{content}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Tabs → Radix Tabs
export function TabsView({ items, defaultValue }: TabsProps) {
  return (
    <Tabs defaultValue={defaultValue ?? items[0]?.id}>
      <TabsList>
        {items.map((i) => (
          <TabsTrigger key={i.id} value={i.id}>
            {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((i) => (
        <TabsContent key={i.id} value={i.id}>
          {i.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

// Alert → shadcn Alert
export function InfoAlert({ title, description, severity = "default" }: AlertProps) {
  return (
    <AlertBox variant={severity}>
      <div className="font-medium">{title}</div>
      {description ? <div className="mt-1 text-foreground/70">{description}</div> : null}
    </AlertBox>
  )
}