'use client';

import { motion } from 'framer-motion';
import {
  Sparkles,
  Layout,
  Palette,
  Eye,
  Wand2,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

type JourneyMode =
  | 'select_entity'
  | 'recommend'
  | 'style'
  | 'build_preview'
  | 'interactive_edit'
  | 'propose'
  | 'build_edit'
  | 'deploy';

interface EmptyPreviewStateProps {
  journeyMode: JourneyMode;
  entityName?: string;
}

const stageConfig: Record<JourneyMode, {
  icon: typeof Sparkles;
  title: string;
  description: string;
  hint: string;
  color: string;
  bgGradient: string;
}> = {
  select_entity: {
    icon: MessageSquare,
    title: "Let's build something",
    description: "Select a workflow entity to get started",
    hint: "Chat with me to choose which data you want to visualize",
    color: "text-violet-500",
    bgGradient: "from-violet-50 to-indigo-50",
  },
  recommend: {
    icon: Wand2,
    title: "Analyzing your data",
    description: "I'm understanding your workflow structure",
    hint: "Answer my questions to help me recommend the best dashboard",
    color: "text-blue-500",
    bgGradient: "from-blue-50 to-cyan-50",
  },
  style: {
    icon: Palette,
    title: "Choose your style",
    description: "Pick a design that matches your brand",
    hint: "Browse style options in the chat to see previews",
    color: "text-pink-500",
    bgGradient: "from-pink-50 to-rose-50",
  },
  build_preview: {
    icon: Sparkles,
    title: "Creating your dashboard",
    description: "Generating components and layout...",
    hint: "This usually takes 5-10 seconds",
    color: "text-amber-500",
    bgGradient: "from-amber-50 to-orange-50",
  },
  interactive_edit: {
    icon: Layout,
    title: "Ready to customize",
    description: "Your dashboard is ready for editing",
    hint: "Use the controls to adjust widgets and styles",
    color: "text-emerald-500",
    bgGradient: "from-emerald-50 to-teal-50",
  },
  deploy: {
    icon: Eye,
    title: "Preview ready",
    description: "Review your dashboard before publishing",
    hint: "Click Deploy when you're happy with the result",
    color: "text-indigo-500",
    bgGradient: "from-indigo-50 to-purple-50",
  },

  propose: {
    icon: Sparkles,
    title: "Crafting your proposals",
    description: "Generating tailored dashboard designs",
    hint: "I'm analyzing your workflow and creating 3 unique proposals",
    color: "text-indigo-500",
    bgGradient: "from-indigo-50 to-violet-50",
  },
  build_edit: {
    icon: Layout,
    title: "Building your dashboard",
    description: "Your selected proposal is being brought to life",
    hint: "Use the chat to request changes to colors, layout, or components",
    color: "text-emerald-500",
    bgGradient: "from-emerald-50 to-teal-50",
  },
};

export function EmptyPreviewState({ journeyMode, entityName }: EmptyPreviewStateProps) {
  const config = stageConfig[journeyMode] || stageConfig.select_entity;
  const Icon = config.icon;

  return (
    <div className={`h-full flex items-center justify-center bg-gradient-to-br ${config.bgGradient} p-8`}>
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Animated Icon Container */}
        <motion.div
          className={`mx-auto mb-6 w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center ${config.color}`}
          animate={{
            scale: journeyMode === 'build_preview' ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: journeyMode === 'build_preview' ? Infinity : 0,
            ease: "easeInOut"
          }}
        >
          <Icon className="w-10 h-10" />
        </motion.div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {config.title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 mb-4">
          {entityName
            ? config.description.replace('your', `"${entityName}"`)
            : config.description
          }
        </p>

        {/* Hint with arrow */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <ArrowRight className="w-4 h-4" />
          <span>{config.hint}</span>
        </div>

        {/* Progress dots for build_preview */}
        {journeyMode === 'build_preview' && (
          <div className="flex justify-center gap-2 mt-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-amber-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
