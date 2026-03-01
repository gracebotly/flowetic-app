"use client";

import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  selected: boolean;
  onClick: () => void;
};

const COLOR_MAP: Record<string, { bg: string; ring: string; icon: string }> = {
  blue:    { bg: "bg-blue-50",    ring: "ring-blue-200 border-blue-500",    icon: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-200 border-emerald-500", icon: "text-emerald-600" },
  violet:  { bg: "bg-violet-50",  ring: "ring-violet-200 border-violet-500",  icon: "text-violet-600" },
  sky:     { bg: "bg-sky-50",     ring: "ring-sky-200 border-sky-500",     icon: "text-sky-600" },
  amber:   { bg: "bg-amber-50",   ring: "ring-amber-200 border-amber-500",   icon: "text-amber-600" },
};

export function OfferingCard({
  title,
  description,
  icon: Icon,
  color,
  selected,
  onClick,
}: Props) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-4 rounded-xl border-2 px-5 py-4 text-left transition ${
        selected
          ? `${colors.bg} ${colors.ring} ring-2`
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
          selected ? colors.bg : "bg-gray-100"
        }`}
      >
        <Icon className={`h-5 w-5 ${selected ? colors.icon : "text-gray-400"}`} />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {description}
        </p>
      </div>
      {/* Selection indicator */}
      <div
        className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
          selected ? `${colors.ring} bg-current` : "border-gray-300 bg-white"
        }`}
      >
        {selected && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path
              d="M10 3L4.5 8.5L2 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
