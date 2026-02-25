"use client";

import React, { useState } from "react";
import { Badge, Text } from "@tremor/react";
import { ShieldAlert, ShieldCheck, Eye, EyeOff, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Popover from "@radix-ui/react-popover";
import type { RenderValidationResult, DroppedComponent } from "@/lib/spec/validateBeforeRender";

interface ValidationOverlayProps {
  result: RenderValidationResult;
}

/** Dev-mode validation overlay. Shows dropped components + schema issues.
 *  Only mount this in development — skip entirely in production builds. */
export function ValidationOverlay({ result }: ValidationOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);

  const hasIssues = result.droppedComponents.length > 0 || result.schemaIssues.length > 0;

  // Nothing to show — clean spec
  if (!hasIssues) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="absolute top-2 right-2 z-50"
      >
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <Text className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Valid</Text>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                className="z-50 px-3 py-2 text-xs bg-gray-900 text-white rounded-lg shadow-lg"
                sideOffset={4}
              >
                All components passed catalog validation
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </motion.div>
    );
  }

  if (!isVisible) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute top-2 right-2 z-50 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        onClick={() => setIsVisible(true)}
      >
        <Eye className="h-3.5 w-3.5 text-amber-500" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="absolute top-2 right-2 z-50 max-w-sm"
      >
        <div className="rounded-lg border border-amber-400/30 bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-sm shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200/50 dark:border-amber-800/50">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <Text className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Validation Issues
              </Text>
              <Badge size="xs" color="amber" className="text-[10px]">
                DEV
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
              >
                <EyeOff className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
              >
                <X className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </button>
            </div>
          </div>

          {/* Summary Badges */}
          <div className="flex flex-wrap gap-1.5 px-3 py-2">
            {result.droppedComponents.length > 0 && (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer">
                    {result.droppedComponents.length} dropped
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    className="z-50 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3"
                  >
                    <Text className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Dropped Components
                    </Text>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {result.droppedComponents.map((d, i) => (
                        <DroppedComponentRow key={i} item={d} />
                      ))}
                    </div>
                    <Popover.Arrow className="fill-white dark:fill-gray-900" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}
            {result.schemaIssues.length > 0 && (
              <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                      {result.schemaIssues.length} schema
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="bottom"
                      className="z-50 max-w-xs px-3 py-2 text-xs bg-gray-900 text-white rounded-lg shadow-lg"
                      sideOffset={4}
                    >
                      <div className="space-y-1">
                        {result.schemaIssues.slice(0, 5).map((issue, i) => (
                          <div key={i} className="text-gray-300">• {issue}</div>
                        ))}
                        {result.schemaIssues.length > 5 && (
                          <div className="text-gray-500">+{result.schemaIssues.length - 5} more</div>
                        )}
                      </div>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DroppedComponentRow({ item }: { item: DroppedComponent }) {
  const reasonLabel = {
    unknown_type: "Not in catalog",
    no_renderer: "No renderer",
    invalid_shape: "Invalid shape",
  }[item.reason];

  const reasonColor = {
    unknown_type: "red",
    no_renderer: "amber",
    invalid_shape: "gray",
  }[item.reason] as "red" | "amber" | "gray";

  return (
    <div className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center gap-2 min-w-0">
        <code className="text-[10px] text-red-600 dark:text-red-400 font-mono truncate">
          {item.type}
        </code>
        <Text className="text-[10px] text-gray-500 truncate">
          {item.id}
        </Text>
      </div>
      <Badge size="xs" color={reasonColor} className="text-[9px] flex-shrink-0">
        {reasonLabel}
      </Badge>
    </div>
  );
}
