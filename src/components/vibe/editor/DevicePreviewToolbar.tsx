"use client";

import React from "react";
import { motion } from "framer-motion";
import { Smartphone, Tablet, Monitor } from "lucide-react";
import type { DeviceMode } from "./types";

interface DevicePreviewToolbarProps {
  value: DeviceMode;
  onChange: (mode: DeviceMode) => void;
  className?: string;
}

const DEVICE_OPTIONS: {
  value: DeviceMode;
  label: string;
  icon: React.ElementType;
  width: string;
}[] = [
  { value: "mobile", label: "Mobile", icon: Smartphone, width: "428px" },
  { value: "tablet", label: "Tablet", icon: Tablet, width: "820px" },
  { value: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
];

export function DevicePreviewToolbar({
  value,
  onChange,
  className = "",
}: DevicePreviewToolbarProps) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-gray-100 rounded-lg ${className}`}
      role="radiogroup"
      aria-label="Device preview mode"
    >
      {DEVICE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer
              transition-colors duration-200
              ${isSelected ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            `}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.label} preview (${option.width})`}
          >
            {/* Background indicator */}
            {isSelected && (
              <motion.div
                layoutId="device-indicator"
                className="absolute inset-0 bg-white rounded-md shadow-sm"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}

            {/* Icon */}
            <Icon className="relative z-10 w-4 h-4" />

            {/* Label - hidden on small screens */}
            <span className="relative z-10 text-sm font-medium hidden sm:inline">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
