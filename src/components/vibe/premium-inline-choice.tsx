"use client";

import { motion } from "framer-motion";
import { Card } from "@tremor/react";
import { Sparkles, HelpCircle } from "lucide-react";
import { useState } from "react";

interface Choice {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  tags?: string[];
}

interface PremiumInlineChoiceProps {
  choices: Choice[];
  onSelect: (id: string) => void;
  helpAvailable?: boolean;
  onHelp?: () => void;
}

export function PremiumInlineChoice({
  choices,
  onSelect,
  helpAvailable,
  onHelp,
}: PremiumInlineChoiceProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="my-6 space-y-3"
    >
      {choices.map((choice, index) => (
        <motion.div
          key={choice.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card
            className="p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2"
            onClick={() => onSelect(choice.id)}
            onMouseEnter={() => setHoveredId(choice.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              borderColor: hoveredId === choice.id ? "#6366f1" : "#e5e7eb",
              background:
                hoveredId === choice.id
                  ? "linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)"
                  : "#ffffff",
            }}
          >
            <div className="flex items-start gap-4">
              {choice.emoji && (
                <motion.div
                  className="text-4xl"
                  animate={hoveredId === choice.id ? { scale: 1.2 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {choice.emoji}
                </motion.div>
              )}

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {choice.label}
                  {hoveredId === choice.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                    </motion.div>
                  )}
                </h3>
                {choice.description && (
                  <p className="text-sm text-gray-600 mt-1">{choice.description}</p>
                )}

                {choice.tags && choice.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {choice.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      ))}

      {helpAvailable && onHelp && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={onHelp}
          className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Not sure? Help me decide</span>
        </motion.button>
      )}
    </motion.div>
  );
}
