export type MetricCardProps = {
  title: string
  value: string | number
  delta?: { value: number; trend: "up" | "down" | "flat"; label?: string }
  unit?: string
  icon?: React.ReactNode
}

export type Series = { name: string; data: { date: string | Date; value: number }[] }

export type TimeseriesChartProps = {
  series: Series[]
  xKey?: "date"
  yKey?: "value"
  yFormat?: (n: number) => string
}

export type BarChartProps = {
  series: { name: string; value: number }[]
  xKey?: "name"
  yKey?: "value"
}

export type DataTableColumn<T> = {
  key: keyof T
  header: string
  cell?: (row: T) => React.ReactNode
}

export type DataTableProps<T extends object> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  pageSize?: number
}

export type AlertProps = { title: string; description?: string; severity?: "default" | "success" | "warning" | "danger" }

export type ModalProps = { title: string; description?: string; triggerLabel: string; content: React.ReactNode }

export type TabsProps = { items: { id: string; label: string; content: React.ReactNode }[]; defaultValue?: string }