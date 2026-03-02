"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

interface DateRangePickerProps {
  from: string | null;
  to: string | null;
  activePreset: string | null;
  onPresetSelect: (preset: "1h" | "24h" | "7d" | "30d" | "90d") => void;
  onCustomRange: (from: string, to: string) => void;
  onClear: () => void;
}

const PRESETS = [
  { key: "1h" as const, label: "1h" },
  { key: "24h" as const, label: "24h" },
  { key: "7d" as const, label: "7d" },
  { key: "30d" as const, label: "30d" },
  { key: "90d" as const, label: "90d" },
];

export function DateRangePicker({
  from,
  to,
  activePreset,
  onPresetSelect,
  onCustomRange,
  onClear,
}: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      onCustomRange(
        new Date(customFrom).toISOString(),
        new Date(customTo + "T23:59:59").toISOString(),
      );
      setShowCustom(false);
    }
  };

  const isActive = !!(from || to);

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPresetSelect(p.key)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              activePreset === p.key
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}

        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            isActive && !activePreset
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Calendar className="h-3 w-3" />
          Custom
        </button>

        {isActive && (
          <button
            onClick={onClear}
            className="rounded-md px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="absolute left-0 top-full z-10 mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!customFrom || !customTo}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
