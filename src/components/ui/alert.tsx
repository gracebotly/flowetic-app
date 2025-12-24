import { cn } from "@/lib/utils"

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "warning" | "danger" }) {
  const map: Record<string, string> = {
    default: "border border-border bg-card text-foreground",
    success: "border border-green-200 bg-green-50 text-green-800",
    warning: "border border-yellow-200 bg-yellow-50 text-yellow-800",
    danger: "border border-red-200 bg-red-50 text-red-800",
  }
  return <div className={cn("rounded-md p-4 text-sm", map[variant], className)} {...props} />
}