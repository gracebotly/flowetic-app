"use client";

import { motion } from "framer-motion";
import { BarChart3, AlertCircle, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Badge, Text } from "@tremor/react";

interface StoryboardCardsProps {
  options: Array<{
    id: string;
    title: string;
    description: string;
    kpis: string[];
  }>;
  onSelect: (id: string) => void;
}

const storyboardIcons = {
  roi_proof: TrendingUp,
  reliability_ops: AlertCircle,
  delivery_sla: Clock,
  default: BarChart3,
};

const storyboardColors = {
  roi_proof: {
    bg: "bg-gradient-to-br from-green-500/10 to-emerald-600/5",
    border: "border-green-500/30 hover:border-green-400/50",
    icon: "text-green-400",
    badge: "bg-green-500/10 text-green-400 border-green-400/20",
  },
  reliability_ops: {
    bg: "bg-gradient-to-br from-orange-500/10 to-red-600/5",
    border: "border-orange-500/30 hover:border-orange-400/50",
    icon: "text-orange-400",
    badge: "bg-orange-500/10 text-orange-400 border-orange-400/20",
  },
  delivery_sla: {
    bg: "bg-gradient-to-br from-blue-500/10 to-cyan-600/5",
    border: "border-blue-500/30 hover:border-blue-400/50",
    icon: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-400/20",
  },
  default: {
    bg: "bg-gradient-to-br from-purple-500/10 to-pink-600/5",
    border: "border-purple-500/30 hover:border-purple-400/50",
    icon: "text-purple-400",
    badge: "bg-purple-500/10 text-purple-400 border-purple-400/20",
  },
};

export function StoryboardCards({ options, onSelect }: StoryboardCardsProps) {
  return (
    <div className="w-full space-y-6 py-4">
      {/* Header */}
      <div className="px-1">
        <h3 className="text-lg font-semibold text-white mb-1">Choose Your Story</h3>
        <Text className="text-sm text-gray-400">Select the narrative your dashboard will tell</Text>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options.map((storyboard, index) => {
          const colorKey = storyboard.id as keyof typeof storyboardColors;
          const colors = storyboardColors[colorKey] || storyboardColors.default;
          const Icon = storyboardIcons[colorKey as keyof typeof storyboardIcons] || storyboardIcons.default;

          return (
            <motion.div
              key={storyboard.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.03 }}
              className="group"
            >
              <Card
                className={cn(
                  "relative overflow-hidden cursor-pointer transition-all duration-300 h-full",
                  "border-2",
                  colors.bg,
                  colors.border,
                  "hover:shadow-xl backdrop-blur-sm"
                )}
                onClick={() => onSelect(storyboard.id)}
              >
                {/* Content */}
                <div className="space-y-4">
                  {/* Icon */}
                  <div className={cn("p-3 rounded-xl w-fit", colors.badge, "border")}>
                    <Icon className={cn("h-5 w-5", colors.icon)} />
                  </div>

                  {/* Title */}
                  <div>
                    <h4 className="text-base font-semibold text-white mb-2">
                      {storyboard.title}
                    </h4>
                    <Text className="text-xs text-gray-400 leading-relaxed">
                      {storyboard.description}
                    </Text>
                  </div>

                  {/* KPIs */}
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <Text className="text-xs font-medium text-gray-400">Key Metrics:</Text>
                    {storyboard.kpis.slice(0, 4).map((kpi, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-gray-500" />
                        <Text className="text-xs text-gray-300">{kpi}</Text>
                      </div>
                    ))}
                    {storyboard.kpis.length > 4 && (
                      <Text className="text-xs text-gray-500 italic">
                        +{storyboard.kpis.length - 4} more
                      </Text>
                    )}
                  </div>

                  {/* Select CTA */}
                  <motion.div
                    className="flex items-center justify-end gap-2 text-xs font-medium text-white/60 group-hover:text-white transition-colors"
                    whileHover={{ x: 2 }}
                  >
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
