"use client";

import { BarChart3, Play, Layers } from "lucide-react";

const SURFACE_META: Record<string, { label: string; icon: typeof BarChart3; color: string }> = {
  analytics: { label: "Analytics", icon: BarChart3, color: "text-blue-700 bg-blue-50" },
  runner: { label: "Workflow Runner", icon: Play, color: "text-emerald-700 bg-emerald-50" },
  both: { label: "Analytics + Runner", icon: Layers, color: "text-violet-700 bg-violet-50" },
};

interface SurfaceBadgeProps {
  surfaceType: string;
  size?: "sm" | "md";
}

export function SurfaceBadge({ surfaceType, size = "sm" }: SurfaceBadgeProps) {
  const meta = SURFACE_META[surfaceType] || SURFACE_META.analytics;
  const Icon = meta.icon;
  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-xs";
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${meta.color} ${sizeClass}`}>
      <Icon className={iconSize} />
      {meta.label}
    </span>
  );
}
