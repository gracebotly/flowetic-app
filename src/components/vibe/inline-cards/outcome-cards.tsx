

"use client";

import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Users, 
  Zap, 
  Shield,
  Check,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Badge, Metric } from "@tremor/react";

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

// Icon mapping for metrics
const metricIcons: Record<string, any> = {
  call_volume: BarChart3,
  success_rate: TrendingUp,
  executions_count: Zap,
  active_users: Users,
  monthly_revenue: Package,
  default: Shield,
};

// Category color schemes
const categoryColors = {
  dashboard: {
    gradient: "from-blue-500/20 via-cyan-500/20 to-blue-600/20",
    border: "border-blue-500/50",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    glow: "shadow-blue-500/20",
  },
  product: {
    gradient: "from-purple-500/20 via-pink-500/20 to-purple-600/20",
    border: "border-purple-500/50",
    badge: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    glow: "shadow-purple-500/20",
  },
  operations: {
    gradient: "from-emerald-500/20 via-teal-500/20 to-emerald-600/20",
    border: "border-emerald-500/50",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    glow: "shadow-emerald-500/20",
  },
};

export function OutcomeCards({ options, onSelect, onHelpDecide }: OutcomeCardsProps) {
  return (
    <div className="space-y-6">
      {/* Header with help option */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Choose Your Outcome</h3>
        </div>
        {onHelpDecide && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onHelpDecide}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Need help deciding? <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Premium card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((outcome, index) => {
          const category = outcome.category || "dashboard";
          const colors = categoryColors[category];
          const primaryMetric = outcome.metrics?.primary?.[0] || "default";
          const MetricIcon = metricIcons[primaryMetric] || metricIcons.default;

          return (
            <motion.div
              key={outcome.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative"
            >
              {/* Glow effect on hover */}
              <div
                className={cn(
                  "absolute -inset-1 rounded-2xl bg-gradient-to-r opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100",
                  colors.gradient
                )}
              />

              {/* Main card */}
              <Card
                className={cn(
                  "relative overflow-hidden border-2 cursor-pointer transition-all duration-300",
                  "bg-white dark:bg-gray-900",
                  colors.border,
                  "hover:shadow-2xl",
                  colors.glow
                )}
                onClick={() => onSelect(outcome.id)}
              >
                {/* Preview image with overlay */}
                {outcome.previewImageUrl && (
                  <div className="relative h-48 overflow-hidden rounded-t-lg mb-4 -mt-6 -mx-6">
                    {/* Shimmer loading effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    
                    {/* Image with parallax */}
                    <motion.img
                      src={outcome.previewImageUrl}
                      alt={outcome.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      whileHover={{ scale: 1.1 }}
                    />

                    {/* Gradient overlay */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                    )} />

                    {/* Category badge on image */}
                    <div className="absolute top-4 right-4">
                      <Badge
                        className={cn(
                          "border backdrop-blur-sm",
                          colors.badge
                        )}
                      >
                        {category}
                      </Badge>
                    </div>

                    {/* Metric icon */}
                    <div className="absolute bottom-4 left-4">
                      <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                        <MetricIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="space-y-4">
                  {/* Title */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-lg font-semibold tracking-tight group-hover:text-blue-600 transition-colors">
                      {outcome.title}
                    </h4>
                    <motion.div
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      whileHover={{ x: 4 }}
                    >
                      <ArrowRight className="h-5 w-5 text-blue-500" />
                    </motion.div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {outcome.description}
                  </p>

                  {/* Primary metrics with animated badges */}
                  {outcome.metrics?.primary && outcome.metrics.primary.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {outcome.metrics.primary.slice(0, 3).map((metric, idx) => {
                        const Icon = metricIcons[metric] || metricIcons.default;
                        return (
                          <motion.div
                            key={metric}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 + idx * 0.05 }}
                            whileHover={{ scale: 1.1 }}
                          >
                            <Badge
                              className={cn(
                                "border backdrop-blur-sm flex items-center gap-1.5",
                                colors.badge
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              <span className="text-xs font-medium">
                                {metric.replace(/_/g, " ")}
                              </span>
                            </Badge>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tags */}
                  {outcome.tags && outcome.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                      {outcome.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Selection indicator */}
                  <motion.div
                    className="flex items-center gap-2 text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    whileHover={{ x: 4 }}
                  >
                    <Check className="h-4 w-4" />
                    Select this outcome
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

