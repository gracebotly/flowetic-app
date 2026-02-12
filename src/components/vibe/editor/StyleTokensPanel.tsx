"use client";

import React from "react";
import { motion } from "framer-motion";

interface StyleTokensPanelProps {
  borderRadius: number;
  shadowIntensity: "none" | "subtle" | "medium" | "strong";
  onBorderRadiusChange: (value: number) => void;
  onShadowChange: (value: "none" | "subtle" | "medium" | "strong") => void;
}

const RADIUS_OPTIONS = [
  { value: 0, label: "Sharp" },
  { value: 4, label: "Slight" },
  { value: 8, label: "Rounded" },
  { value: 12, label: "Soft" },
  { value: 16, label: "Pill" },
];

const SHADOW_OPTIONS: {
  value: "none" | "subtle" | "medium" | "strong";
  label: string;
  preview: string;
}[] = [
  { value: "none", label: "None", preview: "none" },
  { value: "subtle", label: "Subtle", preview: "0 2px 4px rgba(0,0,0,0.05)" },
  { value: "medium", label: "Medium", preview: "0 4px 8px rgba(0,0,0,0.1)" },
  { value: "strong", label: "Strong", preview: "0 8px 16px rgba(0,0,0,0.15)" },
];

export function StyleTokensPanel({
  borderRadius,
  shadowIntensity,
  onBorderRadiusChange,
  onShadowChange,
}: StyleTokensPanelProps) {
  return (
    <div className="space-y-6">
      {/* Border Radius Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Border Radius
          </label>
          <span className="text-sm text-gray-500">{borderRadius}px</span>
        </div>

        <input
          type="range"
          min="0"
          max="16"
          step="4"
          value={borderRadius}
          onChange={(e) => onBorderRadiusChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          aria-label="Border radius"
        />

        <div className="flex justify-between text-[10px] text-gray-400">
          {RADIUS_OPTIONS.map((opt) => (
            <span key={opt.value}>{opt.label}</span>
          ))}
        </div>

        {/* Preview card */}
        <div className="flex justify-center pt-2">
          <motion.div
            animate={{ borderRadius }}
            className="w-24 h-16 bg-gradient-to-br from-blue-500 to-indigo-600"
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
        </div>
      </div>

      {/* Shadow Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">
          Card Shadow
        </label>

        <div className="grid grid-cols-4 gap-2">
          {SHADOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onShadowChange(option.value)}
              className={`
                relative flex flex-col items-center p-2 rounded-lg border-2 cursor-pointer
                transition-all duration-200
                ${shadowIntensity === option.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              `}
              aria-pressed={shadowIntensity === option.value}
              aria-label={`${option.label} shadow`}
            >
              {/* Preview */}
              <div
                className="w-10 h-8 bg-white rounded mb-1.5"
                style={{ boxShadow: option.preview }}
              />
              <span
                className={`
                  text-[10px] font-medium
                  ${shadowIntensity === option.value ? "text-blue-700" : "text-gray-600"}
                `}
              >
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
