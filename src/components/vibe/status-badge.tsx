"use client";

import { motion } from "framer-motion";
import {
  Search,
  Zap,
  MapPin,
  Palette,
  Hammer,
  Sparkles,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type JourneyStatus =
  | "selecting"
  | "analyzing"
  | "planning"
  | "designing"
  | "building"
  | "refining"
  | "ready";

interface StatusBadgeProps {
  status: JourneyStatus;
  message?: string;
  className?: string;
}

const STATUS_CONFIG = {
  selecting: {
    icon: Search,
    message: "Choose your direction...",
    color: "purple",
    animate: false
  },
  analyzing: {
    icon: Zap,
    message: "Understanding your workflow...",
    color: "indigo",
    animate: true
  },
  planning: {
    icon: MapPin,
    message: "Mapping your dashboard...",
    color: "indigo",
    animate: true
  },
  designing: {
    icon: Palette,
    message: "Crafting your style...",
    color: "indigo",
    animate: true
  },
  building: {
    icon: Hammer,
    message: "Generating preview...",
    color: "indigo",
    animate: true
  },
  refining: {
    icon: Sparkles,
    message: "Adjusting details...",
    color: "purple",
    animate: false
  },
  ready: {
    icon: CheckCircle,
    message: "Dashboard ready!",
    color: "green",
    animate: false
  },
} as const;

const pulseVariants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export function StatusBadge({
  status,
  message,
  className
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const displayMessage = message || config.message;

  return (
    <motion.div
      key={status}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "text-sm font-medium border shadow-sm",
        config.color === "purple" && "bg-purple-50 text-purple-700 border-purple-200",
        config.color === "indigo" && "bg-indigo-50 text-indigo-700 border-indigo-200",
        config.color === "green" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        variants={config.animate ? pulseVariants : undefined}
        initial={config.animate ? "initial" : undefined}
        animate={config.animate ? "animate" : undefined}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
      </motion.div>
      <span>{displayMessage}</span>
    </motion.div>
  );
}
