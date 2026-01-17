
"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Package } from "lucide-react";

interface OutcomeCardsProps {
  options: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  onSelect: (id: string) => void;
}

export function OutcomeCards({ options, onSelect }: OutcomeCardsProps) {
  const getIcon = (id: string) => {
    if (id === "dashboard") return LayoutDashboard;
    if (id === "product") return Package;
    return LayoutDashboard;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
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
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Icon size={20} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {opt.title}
              </h3>
              <p className="text-sm text-gray-600">{opt.description}</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
