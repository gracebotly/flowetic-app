"use client";

import { motion } from "framer-motion";
import { Sparkles, Paintbrush, Rocket } from "lucide-react";

type JourneyMode =
  | "propose"
  | "build_edit"
  | "deploy";

interface PhaseIndicatorProps {
  currentMode: JourneyMode | string;
}

const PHASES = [
  { id: "propose", label: "Propose", step: 1, icon: Sparkles },
  { id: "build_edit", label: "Build & Edit", step: 2, icon: Paintbrush },
  { id: "deploy", label: "Deploy", step: 3, icon: Rocket },
] as const;

// Map legacy phase names to new phases
function normalizePhase(mode: string): string {
  const legacyMap: Record<string, string> = {
    select_entity: "propose",
    recommend: "propose",
    style: "propose",
    align: "propose",
    build_preview: "build_edit",
    interactive_edit: "build_edit",
  };
  return legacyMap[mode] ?? mode;
}

export function PhaseIndicator({ currentMode }: PhaseIndicatorProps) {
  const normalizedMode = normalizePhase(currentMode);
  const currentPhaseIndex = PHASES.findIndex((p) => p.id === normalizedMode);
  const safeIndex = currentPhaseIndex === -1 ? 0 : currentPhaseIndex;
  const progress = ((safeIndex + 1) / PHASES.length) * 100;

  return (
    <div className="w-full">
      {/* Phase Steps */}
      <div className="flex items-center justify-between mb-3">
        {PHASES.map((phase, index) => {
          const Icon = phase.icon;
          const isActive = index === safeIndex;
          const isCompleted = index < safeIndex;

          return (
            <div key={phase.id} className="flex items-center gap-2">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  transition-colors duration-200
                  ${isActive
                    ? "bg-blue-600 text-white"
                    : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`
                  text-sm font-medium transition-colors duration-200
                  ${isActive
                    ? "text-gray-900 dark:text-white"
                    : isCompleted
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-400 dark:text-gray-500"
                  }
                `}
              >
                {phase.label}
              </span>

              {/* Connector line (not after last) */}
              {index < PHASES.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 min-w-[2rem] transition-colors duration-200
                    ${isCompleted
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-700"
                    }
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
