"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ChevronDown, Copy, Check } from "lucide-react";

interface ErrorDisplayProps {
  error: string;
  title?: string;
}

export function ErrorDisplay({ error, title = "Error" }: ErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!error || error.trim().length === 0) {
    return null;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20 overflow-hidden"
    >
      {/* Compact Error Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm font-medium text-red-900 dark:text-red-200">
            {title}
          </span>
          <span className="text-xs text-red-600 dark:text-red-400 opacity-75">
            (click to view details)
          </span>
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-red-600 dark:text-red-400" />
        </motion.div>
      </button>

      {/* Expandable Error Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-red-200 dark:border-red-900/30 bg-white dark:bg-red-950/40 p-3">
              {/* Copy Button */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy error</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              <pre className="text-xs text-red-900 dark:text-red-200 whitespace-pre-wrap font-mono bg-red-50 dark:bg-red-950/60 p-2 rounded border border-red-200 dark:border-red-900/30 max-h-64 overflow-auto">
                {error}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
