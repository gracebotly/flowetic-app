"use client";

import { motion } from "framer-motion";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

interface PhaseIndicatorProps {
  currentMode: JourneyMode;
}

const PHASES = [
  { id: "select_entity", label: "Select", step: 1 },
  { id: "recommend", label: "Outcome", step: 2 },
  { id: "style", label: "Style", step: 3 },
  { id: "build_preview", label: "Preview", step: 4 },
  { id: "interactive_edit", label: "Refine", step: 5 },
  { id: "deploy", label: "Deploy", step: 6 },
] as const;

export function PhaseIndicator({ currentMode }: PhaseIndicatorProps) {
  // Handle legacy "align" phase — map it to "style" so the bar doesn't break
  const normalizedMode = currentMode === ("align" as string) ? "style" : currentMode;

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === normalizedMode);
  const safeIndex = currentPhaseIndex === -1 ? 0 : currentPhaseIndex;
  const progress = ((safeIndex + 1) / PHASES.length) * 100;

  // Yellow line at Phase 3 (style) = step 3 of 6 = 50%
  const previewThreshold = (3 / PHASES.length) * 100;

  const isBeforePreview = safeIndex < 2; // Before "style" phase

  return (
    <div className="w-full">
      {/* Progress Bar Container */}
      <div className="relative w-full h-2 bg-white dark:bg-gray-900 rounded-full overflow-hidden border border-gray-200">
        {/* Green Progress Fill (animated) */}
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        {/* Yellow Preview Threshold Line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-yellow-400 z-10"
          style={{ left: `${previewThreshold}%` }}
        >
          {/* Yellow marker dot */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-sm" />
        </div>
      </div>

      {/* Status Text */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400 font-medium">
          {PHASES[safeIndex]?.label || "Processing..."}
        </span>

        {isBeforePreview && (
          <motion.span
            className="text-yellow-600 dark:text-yellow-400"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Preview will appear once you reach the yellow line
          </motion.span>
        )}

        {!isBeforePreview && safeIndex < PHASES.length - 1 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            Preview available
          </span>
        )}

        {safeIndex === PHASES.length - 1 && (
          <span className="text-green-600 dark:text-green-400 font-semibold">
            Complete ✓
          </span>
        )}
      </div>
    </div>
  );
}
