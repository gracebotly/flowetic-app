"use client";

import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";

interface Choice {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
}

interface InlineChoiceProps {
  choices: Choice[];
  onSelect: (id: string) => void;
  onHelp?: () => void;
  helpText?: string;
}

export function InlineChoice({
  choices,
  onSelect,
  onHelp,
  helpText = "Help me decide"
}: InlineChoiceProps) {
  return (
    <div className="flex flex-wrap gap-2 my-3">
      {choices.map((choice) => (
        <motion.button
          key={choice.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(choice.id)}
          className="group relative px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center gap-2">
            {choice.emoji && <span className="text-base">{choice.emoji}</span>}
            <span className="text-sm font-medium text-white/90">
              {choice.label}
            </span>
          </div>

          {choice.description && (
            <div className="absolute left-0 right-0 top-full mt-2 p-3 rounded-lg bg-gray-900 border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 min-w-max">
              <span className="text-xs text-white/60">{choice.description}</span>
            </div>
          )}
        </motion.button>
      ))}

      {onHelp && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onHelp}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-white/40" />
            <span className="text-sm text-white/60">{helpText}</span>
          </div>
        </motion.button>
      )}
    </div>
  );
}
