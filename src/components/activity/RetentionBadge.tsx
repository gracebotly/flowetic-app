"use client";

import { Shield } from "lucide-react";

export function RetentionBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <Shield className="h-3 w-3" />
      90-day retention
    </span>
  );
}
