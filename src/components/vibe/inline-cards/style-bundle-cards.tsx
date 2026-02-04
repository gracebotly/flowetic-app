"use client";

import { motion } from "framer-motion";
import { Palette, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Badge, Text } from "@tremor/react";

interface StyleBundleCardsProps {
  bundles: Array<{
    id: string;
    name: string;
    description: string;
    previewImageUrl?: string;
    palette?: {
      name: string;
      swatches: Array<{ name: string; hex: string }>;
    };
    tags?: string[];
  }>;
  onSelect: (id: string) => void;
}

export function StyleBundleCards({ bundles, onSelect }: StyleBundleCardsProps) {
  return (
    <div className="w-full space-y-6 py-4">
      {/* Header */}
      <div className="px-1">
        <div className="flex items-center gap-3 mb-1">
          <Palette className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Choose Your Style</h3>
        </div>
        <Text className="text-sm text-gray-400">Pick the visual style that matches your brand</Text>
      </div>

      {/* Style Grid (2x2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bundles.map((bundle, index) => (
          <motion.div
            key={bundle.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4 }}
            className="group"
          >
            <Card
              className={cn(
                "relative overflow-hidden cursor-pointer transition-all duration-300",
                "border-2 border-white/10 hover:border-purple-400/50",
                "bg-gradient-to-br from-white/5 to-white/[0.02]",
                "hover:shadow-xl hover:shadow-purple-500/20",
                "backdrop-blur-sm"
              )}
              onClick={() => onSelect(bundle.id)}
            >
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Content */}
              <div className="relative space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {bundle.name}
                    </h4>
                    <Text className="text-sm text-gray-400">
                      {bundle.description}
                    </Text>
                  </div>
                </div>

                {/* Color Palette */}
                {bundle.palette && bundle.palette.swatches.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <Text className="text-xs font-medium text-gray-400">Color Palette:</Text>
                    <div className="flex gap-2">
                      {bundle.palette.swatches.slice(0, 5).map((swatch, idx) => (
                        <motion.div
                          key={idx}
                          whileHover={{ scale: 1.2 }}
                          className="group/swatch relative"
                        >
                          <div
                            className="h-10 w-10 rounded-lg border border-white/20 shadow-lg"
                            style={{ backgroundColor: swatch.hex }}
                          />
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover/swatch:opacity-100 transition-opacity whitespace-nowrap">
                            {swatch.name}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {bundle.tags && bundle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {bundle.tags.map((tag) => (
                      <Badge
                        key={tag}
                        size="xs"
                        color="slate"
                        className="bg-white/5 text-gray-400 border border-white/10"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Select CTA */}
                <motion.div
                  className="flex items-center justify-end gap-2 text-sm font-medium text-white/60 group-hover:text-white transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <span>Select this style</span>
                  <CheckCircle2 className="h-4 w-4" />
                </motion.div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
