export function PageHeader({
  title,
  subtitle,
  rightSlot,
}: {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
}) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {rightSlot ?? null}
      </div>
    </header>
  )
}