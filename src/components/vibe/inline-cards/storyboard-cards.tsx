

"use client";

import { motion } from "framer-motion";
import { Check, Users, TrendingUp, FileText, Zap, Monitor, Globe } from "lucide-react";
import Image from "next/image";

type VisualStoryOption = {
  id: string;
  title: string;
  description: string;
  audience: string;
  visualPreview: string;
  exampleMetrics: string[];
  tags: string[];
};

type StoryboardCardsProps = {
  options: VisualStoryOption[];
  onSelect: (id: string) => void;
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  performance_snapshot: TrendingUp,
  deep_analytics: Monitor,
  impact_report: FileText,
  user_control_panel: Zap,
  workflow_monitor: Monitor,
  client_portal: Globe,
};

export function StoryboardCards({ options, onSelect }: StoryboardCardsProps) {
  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-medium text-gray-700 mb-2">
        Choose your visual story style:
      </div>

      {options.map((option, index) => {
        const Icon = iconMap[option.id] || TrendingUp;

        return (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <button
              onClick={() => onSelect(option.id)}
              className="w-full text-left rounded-xl border-2 border-gray-200 bg-white p-4 hover:border-indigo-400 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex gap-4">
                {/* Icon Section */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {option.title}
                  </h4>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {option.description}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-medium">Best for:</span>
                    <span>{option.audience}</span>
                  </div>

                  {/* Example Metrics */}
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Example metrics:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {option.exampleMetrics.map((metric) => (
                        <span
                          key={metric}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-xs text-gray-700"
                        >
                          <Check className="w-3 h-3 text-green-600" />
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {option.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-xs text-indigo-700 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex-shrink-0 self-center">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

