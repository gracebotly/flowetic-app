"use client";

import { motion } from "framer-motion";
import { Check, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface DesignSystem {
  id: string;
  name: string;
  emoji: string;
  colors: string;
  style: string;
  typography: string;
  bestFor: string;
  fullOutput?: string; // Complete markdown from UI UX Pro Max
}

interface DesignSystemPairProps {
  systems: [DesignSystem, DesignSystem]; // Always exactly 2
  onSelect: (id: string) => void;
  onShowMore?: () => void;
  hasMore?: boolean;
}

export function DesignSystemPair({ systems, onSelect, onShowMore, hasMore = true }: DesignSystemPairProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4 my-4">
      {systems.map((system, index) => (
        <motion.div
          key={system.id}
          initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 overflow-hidden"
        >
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{system.emoji}</span>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    OPTION {index + 1}: {system.name}
                  </h4>
                  <p className="text-xs text-white/40 mt-0.5">{system.bestFor}</p>
                </div>
              </div>
            </div>

            {/* Quick Preview */}
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-white/40 min-w-[70px]">Colors:</span>
                <span className="text-white/70">{system.colors}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-white/40 min-w-[70px]">Style:</span>
                <span className="text-white/70">{system.style}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-white/40 min-w-[70px]">Typography:</span>
                <span className="text-white/70">{system.typography}</span>
              </div>
            </div>

            {/* Full Details (collapsible) */}
            {system.fullOutput && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(expanded === system.id ? null : system.id)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {expanded === system.id ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      Hide full details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Show full design system
                    </>
                  )}
                </button>

                {expanded === system.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5"
                  >
                    <pre className="text-xs text-white/60 font-mono overflow-x-auto whitespace-pre-wrap">
                      {system.fullOutput}
                    </pre>
                  </motion.div>
                )}
              </div>
            )}

            {/* Select Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(system.id)}
              className="w-full mt-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              <div className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                Use Option {index + 1}
              </div>
            </motion.button>
          </div>
        </motion.div>
      ))}

      {/* Show More Button */}
      {hasMore && onShowMore && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onShowMore}
          className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm transition-all"
        >
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Show me 2 different styles
          </div>
        </motion.button>
      )}
    </div>
  );
}
