"use client";

import { CheckCircle, Circle } from "lucide-react";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy"
  | "consultation";

interface PhaseIndicatorProps {
  currentMode: JourneyMode;
}

const PHASES = [
  { id: "select_entity", label: "Select", step: 1 },
  { id: "recommend", label: "Outcome", step: 2 },
  { id: "align", label: "Story", step: 3 },
  { id: "style", label: "Style", step: 4 },
  { id: "build_preview", label: "Preview", step: 5 },
  { id: "interactive_edit", label: "Refine", step: 6 },
  { id: "deploy", label: "Deploy", step: 7 },
] as const;

export function PhaseIndicator({ currentMode }: PhaseIndicatorProps) {
  // Hide indicator entirely during consultation mode
  if (currentMode === "consultation") {
    return null;
  }

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === currentMode);

  return (
    <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700">Progress</span>
        <span className="text-xs font-medium text-indigo-600">
          {currentPhaseIndex + 1}/{PHASES.length}
        </span>
      </div>

      {/* Compact horizontal progress bar */}
      <div className="flex items-center gap-1">
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;

          return (
            <div
              key={phase.id}
              className="group relative flex-1"
              title={phase.label}
            >
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? "bg-indigo-500"
                    : isCompleted
                    ? "bg-green-500"
                    : "bg-gray-300"
                }`}
              />
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {phase.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current step label */}
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-indigo-600">
          {PHASES[currentPhaseIndex]?.label || "In Progress"}
        </p>
      </div>
    </div>
  );
}