"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Badge, Metric, Text } from "@tremor/react";

interface OutcomeCardsProps {
  options: Array<{
    id: string;
    title: string;
    description: string;
    previewImageUrl?: string;
    tags?: string[];
    metrics?: {
      primary: string[];
      secondary: string[];
    };
    category?: "dashboard" | "product" | "operations";
  }>;
  onSelect: (id: string) => void;
  onHelpDecide?: () => void;
}

const metricIcons: Record<string, any> = {
  call_volume: BarChart3,
  success_rate: TrendingUp,
  executions_count: Zap,
  active_users: Users,
  monthly_revenue: Package,
  default: Shield,
};

const categoryColors = {
  dashboard: {
    bg: "bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-blue-600/10",
    border: "border-blue-500/30 hover:border-blue-400/50",
    badge: "bg-blue-500/10 text-blue-400 border-blue-400/20",
    glow: "hover:shadow-xl hover:shadow-blue-500/20",
    icon: "text-blue-400",
  },
  product: {
    bg: "bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-600/10",
    border: "border-purple-500/30 hover:border-purple-400/50",
    badge: "bg-purple-500/10 text-purple-400 border-purple-400/20",
    glow: "hover:shadow-xl hover:shadow-purple-500/20",
    icon: "text-purple-400",
  },
  operations: {
    bg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-600/10",
    border: "border-emerald-500/30 hover:border-emerald-400/50",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-400/20",
    glow: "hover:shadow-xl hover:shadow-emerald-500/20",
    icon: "text-emerald-400",
  },
};

export function OutcomeCards({ options, onSelect, onHelpDecide }: OutcomeCardsProps) {
  return (
    <div className="w-full space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Choose Your Outcome</h3>
            <Text className="text-sm text-gray-400">Select what you want to build first</Text>
          </div>
        </div>
        {onHelpDecide && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onHelpDecide}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
          >
            Need help deciding?
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Premium Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((outcome, index) => {
          const category = outcome.category || "dashboard";
          const colors = categoryColors[category];
          const primaryMetrics = outcome.metrics?.primary?.slice(0, 3) || [];
          const Icon = metricIcons[primaryMetrics[0]] || metricIcons.default;

          return (
            <motion.div
              key={outcome.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="group"
            >
              <Card
                className={cn(
                  "relative overflow-hidden cursor-pointer transition-all duration-300",
                  "border-2",
                  colors.bg,
                  colors.border,
                  colors.glow,
                  "backdrop-blur-sm"
                )}
                decoration="top"
                decorationColor="slate"
                onClick={() => onSelect(outcome.id)}
              >
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Content */}
                <div className="relative space-y-4">
                  {/* Header with Icon */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-3 rounded-xl",
                        colors.badge,
                        "border"
                      )}>
                        <Icon className={cn("h-6 w-6", colors.icon)} />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">
                          {outcome.title}
                        </h4>
                        <Badge size="xs" color="slate" className="mt-1">
                          {category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <Text className="text-sm text-gray-300 leading-relaxed">
                    {outcome.description}
                  </Text>

                  {/* Metrics Preview */}
                  {primaryMetrics.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                      {primaryMetrics.map((metric, idx) => {
                        const MetricIcon = metricIcons[metric] || metricIcons.default;
                        return (
                          <Badge
                            key={idx}
                            size="sm"
                            color="slate"
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1",
                              colors.badge
                            )}
                          >
                            <MetricIcon className="h-3 w-3" />
                            <span className="text-xs font-medium capitalize">
                              {metric.replace(/_/g, " ")}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Tags */}
                  {outcome.tags && outcome.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {outcome.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs rounded-md bg-white/5 text-gray-400 border border-white/10"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Selection CTA */}
                  <motion.div
                    className="flex items-center justify-end gap-2 pt-2 text-sm font-medium text-white/60 group-hover:text-white transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <span>Select this outcome</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
