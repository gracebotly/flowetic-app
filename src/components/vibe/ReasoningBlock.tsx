"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";

interface ReasoningBlockProps {
  text: string;
  isStreaming?: boolean;
  thinkingDuration?: number;
}

export function ReasoningBlock({
  text,
  isStreaming = false,
  thinkingDuration,
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || text.trim().length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 overflow-hidden"
    >
      {/* Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-indigo-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-900">
            {isStreaming ? "Thinking..." : "Reasoning"}
          </span>
          {thinkingDuration && (
            <span className="text-xs text-indigo-600">
              ({thinkingDuration}s)
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-indigo-600" />
        </motion.div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 border-t border-indigo-200 bg-white/50">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {text}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
