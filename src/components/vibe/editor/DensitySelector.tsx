"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Density } from "./types";

interface DensitySelectorProps {
  value: Density;
  onChange: (density: Density) => void;
}

const DENSITY_OPTIONS: {
  value: Density;
  label: string;
  spacing: string;
  preview: { gap: number; padding: number };
}[] = [
  {
    value: "compact",
    label: "Compact",
    spacing: "4px gaps",
    preview: { gap: 2, padding: 2 },
  },
  {
    value: "comfortable",
    label: "Comfortable",
    spacing: "8px gaps",
    preview: { gap: 4, padding: 4 },
  },
  {
    value: "spacious",
    label: "Spacious",
    spacing: "12px gaps",
    preview: { gap: 6, padding: 6 },
  },
];

export function DensitySelector({ value, onChange }: DensitySelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Layout Density
      </label>

      <div className="grid grid-cols-3 gap-2">
        {DENSITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              relative flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer
              transition-all duration-200
              ${value === option.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            `}
            aria-pressed={value === option.value}
            aria-label={`${option.label} density`}
          >
            {/* Selection indicator */}
            {value === option.value && (
              <motion.div
                layoutId="density-indicator"
                className="absolute inset-0 border-2 border-blue-500 rounded-lg"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}

            {/* Preview grid */}
            <div
              className="w-full h-12 bg-gray-50 rounded mb-2 flex items-center justify-center"
              style={{ gap: option.preview.gap }}
            >
              <div
                className="grid grid-cols-3"
                style={{
                  gap: option.preview.gap,
                  padding: option.preview.padding,
                }}
              >
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`
                      rounded-sm
                      ${value === option.value ? "bg-blue-400" : "bg-gray-300"}
                    `}
                    style={{
                      width: 12 - option.preview.gap,
                      height: 8 - option.preview.gap / 2,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Label */}
            <span
              className={`
                text-xs font-medium
                ${value === option.value ? "text-blue-700" : "text-gray-600"}
              `}
            >
              {option.label}
            </span>
            <span
              className={`
                text-[10px]
                ${value === option.value ? "text-blue-500" : "text-gray-400"}
              `}
            >
              {option.spacing}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
