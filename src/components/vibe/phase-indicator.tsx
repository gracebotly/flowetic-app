"use client";

import { motion } from "framer-motion";
import { Sparkles, Paintbrush, Rocket, ListChecks, Wand2, Eye } from "lucide-react";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "propose"
  | "build_edit"
  | "deploy";

interface PhaseIndicatorProps {
  currentMode: JourneyMode | string;
}

const PHASES_NEW = [
  { id: "propose", label: "Propose", step: 1, icon: Sparkles },
  { id: "build_edit", label: "Build & Edit", step: 2, icon: Paintbrush },
  { id: "deploy", label: "Deploy", step: 3, icon: Rocket },
] as const;

const PHASES_LEGACY = [
  { id: "select_entity", label: "Select", step: 1, icon: ListChecks },
  { id: "recommend", label: "Outcome", step: 2, icon: Wand2 },
  { id: "style", label: "Style", step: 3, icon: Paintbrush },
  { id: "build_preview", label: "Preview", step: 4, icon: Eye },
  { id: "interactive_edit", label: "Refine", step: 5, icon: Sparkles },
  { id: "deploy", label: "Deploy", step: 6, icon: Rocket },
] as const;

export function PhaseIndicator({ currentMode }: PhaseIndicatorProps) {
  const normalizedMode =
    currentMode === ("align" as string) ? "style" :
    currentMode === ("select_entity" as string) && false ? "propose" :
    currentMode;

  const isNewJourney = normalizedMode === 'propose' || normalizedMode === 'build_edit';
  const PHASES = isNewJourney ? PHASES_NEW : PHASES_LEGACY;
  const currentPhaseIndex = PHASES.findIndex((p) => p.id === normalizedMode);
  const safeIndex = currentPhaseIndex === -1 ? 0 : currentPhaseIndex;
  const progress = ((safeIndex + 1) / PHASES.length) * 100;

  return (
    <div className="w-full">
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
