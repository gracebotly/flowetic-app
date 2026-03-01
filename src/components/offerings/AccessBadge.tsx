"use client";

import { Link2, CreditCard } from "lucide-react";

const ACCESS_META: Record<string, { label: string; icon: typeof Link2; color: string }> = {
  magic_link: { label: "Magic Link", icon: Link2, color: "text-sky-700 bg-sky-50" },
  stripe_gate: { label: "Payment Gate", icon: CreditCard, color: "text-amber-700 bg-amber-50" },
};

interface AccessBadgeProps {
  accessType: string;
  size?: "sm" | "md";
}

export function AccessBadge({ accessType, size = "sm" }: AccessBadgeProps) {
  const meta = ACCESS_META[accessType] || ACCESS_META.magic_link;
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
