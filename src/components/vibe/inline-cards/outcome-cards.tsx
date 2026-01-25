

"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Package, HelpCircle } from "lucide-react";

interface OutcomeCardsProps {
  options: Array<{
    id: string;
    title: string;
    description: string;
    previewImageUrl?: string;
    tags?: string[];
  }>;
  onSelect: (id: string) => void;
  onHelpDecide?: () => void;
}

export function OutcomeCards({ options, onSelect, onHelpDecide }: OutcomeCardsProps) {
  const getIcon = (id: string) => {
    if (id === "dashboard") return LayoutDashboard;
    if (id === "product") return Package;
    return LayoutDashboard;
  };

  return (
    <div className="space-y-4 my-4">
      {/* Main outcome cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((opt, index) => {
          const Icon = getIcon(opt.id);
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(opt.id)}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-6 border border-gray-200 hover:border-indigo-500/50 transition-all duration-500 hover:shadow-[0_20px_70px_-10px_rgba(99,102,241,0.3)] text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
              <div className="relative z-10">
                {opt.previewImageUrl && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={opt.previewImageUrl}
                      alt={opt.title}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {opt.title}
                </h3>
                <p className="text-sm text-gray-600">{opt.description}</p>
                
                {opt.tags && opt.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opt.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* "I'm not sure" button */}
      {onHelpDecide && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex justify-center"
        >
          <button
            onClick={onHelpDecide}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
          >
            <HelpCircle size={16} />
            I'm not sure, help me decide
          </button>
        </motion.div>
      )}
    </div>
  );
}

