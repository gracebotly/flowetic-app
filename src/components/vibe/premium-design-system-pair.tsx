"use client";

import { motion } from "framer-motion";
import { Card } from "@tremor/react";
import {
  Palette,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Sparkles,
  Gem,
  Layers,
  Zap,
  Crown,
  Star,
  Heart,
  type LucideIcon,
} from "lucide-react";

// Icon mapping for design system styles
const STYLE_ICONS: Record<string, LucideIcon> = {
  Palette,
  Sparkles,
  Gem,
  Layers,
  Zap,
  Crown,
  Star,
  Heart,
};

const DEFAULT_ICON = Palette;
import { useState } from "react";

interface DesignSystem {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  colors: string;
  style: string;
  typography: string;
  bestFor: string;
  fullOutput?: string;
}

interface PremiumDesignSystemPairProps {
  systems: [DesignSystem, DesignSystem];
  onSelect: (id: string) => void;
  onShowMore?: () => void;
  hasMore?: boolean;
}

export function PremiumDesignSystemPair({
  systems,
  onSelect,
  onShowMore,
  hasMore,
}: PremiumDesignSystemPairProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="my-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {systems.map((system, index) => (
          <motion.div
            key={system.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.15, type: "spring" }}
          >
            <Card
              className="p-5 cursor-pointer transition-all duration-300 hover:shadow-xl border-2"
              onMouseEnter={() => setHoveredId(system.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                borderColor: hoveredId === system.id ? "#8b5cf6" : "#e5e7eb",
                background:
                  hoveredId === system.id
                    ? "linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)"
                    : "#ffffff",
              }}
            >
              <div
                className="flex items-start justify-between mb-4"
                onClick={() => onSelect(system.id)}
              >
                <div className="flex items-start gap-3">
                  <motion.div
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center"
                    animate={
                      hoveredId === system.id ? { scale: [1, 1.1, 1] } : {}
                    }
                    transition={{ duration: 0.3 }}
                  >
                    {(() => {
                      const IconComponent = STYLE_ICONS[system.icon] || DEFAULT_ICON;
                      return <IconComponent className="w-6 h-6 text-violet-600" />;
                    })()}
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {system.name}
                      {hoveredId === system.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <Palette className="w-4 h-4 text-purple-600" />
                        </motion.div>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{system.style}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Colors:</span>
                  <span className="text-gray-600 ml-2">{system.colors}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Typography:</span>
                  <span className="text-gray-600 ml-2">{system.typography}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Best for:</span>
                  <span className="text-gray-600 ml-2">{system.bestFor}</span>
                </div>
              </div>

              {system.fullOutput && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(
                        expandedId === system.id ? null : system.id
                      );
                    }}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    {expandedId === system.id ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span>Hide details</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Show full details</span>
                      </>
                    )}
                  </button>

                  {expandedId === system.id && (
                    <motion.pre
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="mt-3 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-64"
                    >
                      {system.fullOutput}
                    </motion.pre>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {hasMore && onShowMore && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={onShowMore}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border-2 border-dashed border-purple-200"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>Show me 2 different styles</span>
        </motion.button>
      )}
    </div>
  );
}
