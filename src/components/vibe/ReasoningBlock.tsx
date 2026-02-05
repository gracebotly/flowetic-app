'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Brain } from 'lucide-react';

interface ReasoningBlockProps {
  text: string;
  thinkingDuration?: number;
  isStreaming: boolean;
}

export function ReasoningBlock({
  text,
  thinkingDuration,
  isStreaming
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const [startTime] = useState(Date.now());
  const [displayDuration, setDisplayDuration] = useState(0);

  // Update duration while streaming
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        setDisplayDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else if (thinkingDuration) {
      setDisplayDuration(thinkingDuration);
    }
  }, [isStreaming, startTime, thinkingDuration]);

  // Auto-collapse 2 seconds after streaming completes
  useEffect(() => {
    if (!isStreaming && isExpanded) {
      const timer = setTimeout(() => setIsExpanded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isExpanded]);

  const formattedDuration = displayDuration === 0
    ? 'less than 1 second'
    : `${displayDuration} second${displayDuration !== 1 ? 's' : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 rounded-lg overflow-hidden border border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-purple-50/30"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-indigo-100/40 transition-colors group"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Hide reasoning" : "Show reasoning"}
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-5 h-5 rounded-full ${
            isStreaming
              ? 'bg-indigo-500'
              : 'bg-indigo-400'
          }`}>
            {isStreaming ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Brain className="w-3 h-3 text-white" />
              </motion.div>
            ) : (
              <Brain className="w-3 h-3 text-white" />
            )}
          </div>

          <span className="font-medium text-gray-700">
            {isStreaming ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  Thinking
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ...
                  </motion.span>
                  <span className="text-gray-500 font-normal">
                    {formattedDuration}
                  </span>
                </span>
              </>
            ) : (
              `Thought for ${formattedDuration}`
            )}
          </span>
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1">
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {text}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
