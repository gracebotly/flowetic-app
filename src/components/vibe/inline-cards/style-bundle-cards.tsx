


"use client";

import { motion } from "framer-motion";
import { Palette } from "lucide-react";

interface StyleBundleCardsProps {
  bundles: Array<{
    id: string;
    name: string;
    description: string;
    previewImageUrl?: string;
    palette: {
      name: string;
      swatches: Array<{ name: string; hex: string }>;
    };
    tags?: string[];
  }>;
  onSelect: (id: string) => void;
}

export function StyleBundleCards({ bundles, onSelect }: StyleBundleCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
      {bundles.map((bundle, index) => (
        <motion.button
          key={bundle.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(bundle.id)}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-6 border border-gray-200 hover:border-indigo-500/50 transition-all duration-500 hover:shadow-[0_20px_70px_-10px_rgba(99,102,241,0.3)] text-left"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
          <div className="relative z-10">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Palette size={20} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {bundle.name}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{bundle.description}</p>
            
            <div className="flex items-center gap-2 mb-3">
              {bundle.palette.swatches.slice(0, 5).map((swatch) => (
                <div
                  key={swatch.name}
                  className="h-6 w-6 rounded-full border border-gray-300 shadow-sm"
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.name}
                />
              ))}
            </div>
            
            {bundle.tags && bundle.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bundle.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.button>
      ))}
    </div>
  );
}


