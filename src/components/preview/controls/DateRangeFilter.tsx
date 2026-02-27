"use client";

import React from "react";

interface DateRangeFilterProps {
  value: { preset: string; from?: Date; to?: Date };
  onChange: (range: { preset: string; from?: Date; to?: Date }) => void;
  eventCount?: number;
  totalCount?: number;
}

const PRESETS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

export function DateRangeFilter({ value, onChange, eventCount, totalCount }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      {PRESETS.map((preset) => {
        const isActive = value.preset === preset.key;
        return (
          <button
            key={preset.key}
            onClick={() => onChange({ preset: preset.key })}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
            style={{
              backgroundColor: isActive
                ? "var(--gf-primary, #3b82f6)"
                : "transparent",
              color: isActive
                ? "#fff"
                : "var(--gf-muted, #6b7280)",
              border: isActive
                ? "1px solid var(--gf-primary, #3b82f6)"
                : "1px solid transparent",
            }}
          >
            {preset.label}
          </button>
        );
      })}
      {value.preset !== "all" && eventCount != null && totalCount != null && (
        <span
          className="text-[10px] ml-1"
          style={{ color: "var(--gf-muted, #6b7280)" }}
        >
          {eventCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
