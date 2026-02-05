'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Badge, Text } from '@tremor/react';
import { ChevronDown, Cpu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '< 1s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94]  // Premium easing curve
      }}
      className="mb-4"
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "border border-indigo-200/50 dark:border-indigo-800/30",
          "bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-white/90",
          "dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900/60",
          "backdrop-blur-sm",
          "shadow-sm hover:shadow-md",
          isExpanded && "shadow-md"
        )}
      >
        {/* Ambient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "relative w-full flex items-center justify-between",
            "px-4 py-3",
            "group transition-colors duration-200",
            "hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20"
          )}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse reasoning" : "Expand reasoning"}
          type="button"
        >
          <div className="flex items-center gap-3">
            {/* Icon with animated gradient border */}
            <div className="relative">
              <div className={cn(
                "absolute inset-0 rounded-lg",
                "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
                "opacity-20 blur-sm",
                isStreaming && "animate-pulse"
              )} />
              
              <div className={cn(
                "relative flex items-center justify-center",
                "w-8 h-8 rounded-lg",
                "bg-gradient-to-br from-indigo-500/10 to-purple-500/10",
                "border border-indigo-300/30 dark:border-indigo-700/40",
                "backdrop-blur-sm"
              )}>
                {isStreaming ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ 
                      duration: 3, 
                      repeat: Infinity, 
                      ease: "linear" 
                    }}
                  >
                    <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </motion.div>
                ) : (
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
            </div>

            {/* Text content */}
            <div className="flex items-center gap-2.5">
              <Text className="font-medium text-sm text-gray-700 dark:text-gray-200">
                {isStreaming ? 'Processing' : 'Reasoning'}
              </Text>
              
              {isStreaming && (
                <motion.div
                  className="flex gap-0.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 rounded-full bg-indigo-500"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                    />
                  ))}
                </motion.div>
              )}
              
              <Badge
                size="xs"
                className={cn(
                  "ml-1 font-mono text-[10px]",
                  isStreaming 
                    ? "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700/50"
                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                )}
              >
                {formatDuration(displayDuration)}
              </Badge>
            </div>
          </div>

          {/* Chevron indicator */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex items-center"
          >
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300 transition-colors" />
          </motion.div>
        </button>

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: 'auto', 
                opacity: 1,
                transition: {
                  height: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
                  opacity: { duration: 0.2, delay: 0.1 }
                }
              }}
              exit={{ 
                height: 0, 
                opacity: 0,
                transition: {
                  height: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] },
                  opacity: { duration: 0.1 }
                }
              }}
              className="overflow-hidden"
            >
              <div className="relative px-4 pb-4 pt-2">
                {/* Separator line */}
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-indigo-200/50 to-transparent dark:via-indigo-800/30" />
                
                {/* Content */}
                <div className={cn(
                  "mt-2 text-sm leading-relaxed",
                  "text-gray-600 dark:text-gray-300",
                  "font-normal whitespace-pre-wrap"
                )}>
                  {text}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
