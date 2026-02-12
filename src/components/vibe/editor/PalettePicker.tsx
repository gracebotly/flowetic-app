"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { Palette } from "./types";

interface PalettePickerProps {
  palettes: Palette[];
  selectedId: string | null;
  onChange: (paletteId: string) => void;
}

const MAX_VISIBLE_SWATCHES = 5;

export function PalettePicker({
  palettes,
  selectedId,
  onChange,
}: PalettePickerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (palettes.length === 0) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Color Palette
        </label>
        <p className="text-sm text-gray-500 italic">No palettes available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Color Palette
      </label>

      <div className="grid grid-cols-2 gap-3">
        {palettes.map((palette) => {
          const isSelected = selectedId === palette.id;
          const visibleSwatches = palette.swatches.slice(0, MAX_VISIBLE_SWATCHES);
          const hiddenCount = Math.max(0, palette.swatches.length - MAX_VISIBLE_SWATCHES);

          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => onChange(palette.id)}
              onMouseEnter={() => setHoveredId(palette.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                relative p-3 rounded-lg border-2 cursor-pointer text-left
                transition-all duration-200
                ${isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              `}
              aria-pressed={isSelected}
              aria-label={`Select ${palette.name} palette`}
            >
              {/* Selection checkmark */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Palette name */}
              <span
                className={`
                  block text-sm font-medium mb-2 truncate pr-6
                  ${isSelected ? "text-blue-700" : "text-gray-900"}
                `}
              >
                {palette.name}
              </span>

              {/* Color swatches */}
              <div className="flex items-center gap-1">
                {visibleSwatches.map((swatch, index) => (
                  <div
                    key={index}
                    className="w-5 h-5 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.name}
                  />
                ))}
                {hiddenCount > 0 && (
                  <span className="text-xs text-gray-400 ml-1">
                    +{hiddenCount}
                  </span>
                )}
              </div>

              {/* Hover tooltip with full palette */}
              <AnimatePresence>
                {hoveredId === palette.id && palette.swatches.length > MAX_VISIBLE_SWATCHES && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 right-0 top-full mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {palette.swatches.map((swatch, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5"
                        >
                          <div
                            className="w-4 h-4 rounded-full border border-gray-200"
                            style={{ backgroundColor: swatch.hex }}
                          />
                          <span className="text-xs text-gray-600">
                            {swatch.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </div>
  );
}
