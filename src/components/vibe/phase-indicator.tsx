"use client";

import { CheckCircle, Circle } from "lucide-react";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

interface PhaseIndicatorProps {
  currentMode: JourneyMode;
}

const PHASES = [
  { id: "select_entity", label: "Select Entity", step: 1 },
  { id: "recommend", label: "Choose Outcome", step: 2 },
  { id: "align", label: "Pick Story", step: 3 },
  { id: "style", label: "Choose Style", step: 4 },
  { id: "build_preview", label: "Generate Preview", step: 5 },
  { id: "interactive_edit", label: "Refine", step: 6 },
  { id: "deploy", label: "Deploy", step: 7 },
] as const;

export function PhaseIndicator({ currentMode }: PhaseIndicatorProps) {
  const currentPhaseIndex = PHASES.findIndex((p) => p.id === currentMode);

  return (
    <div className="mb-4 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          Build Progress
        </h3>
        <span className="text-xs font-medium text-indigo-600">
          Step {currentPhaseIndex + 1} of {PHASES.length}
        </span>
      </div>

      <div className="space-y-2">
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;
          const isUpcoming = index > currentPhaseIndex;

          return (
            <div
              key={phase.id}
              className={`flex items-center gap-3 rounded-lg p-2 transition-all duration-300 ${
                isCurrent
                  ? "bg-indigo-500/10 border border-indigo-500/30"
                  : "bg-transparent"
              }`}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : isCurrent ? (
                  <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isCurrent
                      ? "text-indigo-600"
                      : isCompleted
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {phase.label}
                </p>
              </div>

              <div
                className={`text-xs font-mono ${
                  isCurrent
                    ? "text-indigo-600 font-bold"
                    : isCompleted
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {phase.step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}