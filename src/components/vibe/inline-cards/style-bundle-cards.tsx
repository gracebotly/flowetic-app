


"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

export type StyleBundle = {
  id: string;
  name: string;
  description: string;
  previewImageUrl?: string;
  palette: {
    name: string;
    swatches: Array<{ name: string; hex: string }>;
  };
  tags: string[];
};

type StyleBundleCardsProps = {
  title: string;
  bundles: StyleBundle[];
  onSelect: (bundleId: string) => void;
  selectedBundleId?: string;
};

export function StyleBundleCards({
  title,
  bundles,
  onSelect,
  selectedBundleId,
}: StyleBundleCardsProps) {
  return (
    <div className="w-full py-6">
      {/* Title */}
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-500" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {/* Grid of bundles (2x2) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {bundles.map((bundle) => (
          <StyleBundleCard
            key={bundle.id}
            bundle={bundle}
            isSelected={selectedBundleId === bundle.id}
            onSelect={() => onSelect(bundle.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StyleBundleCard({
  bundle,
  isSelected,
  onSelect,
}: {
  bundle: StyleBundle;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all
        ${
          isSelected
            ? "border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-500/20"
            : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
        }
      `}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Preview Image / Placeholder */}
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {bundle.previewImageUrl ? (
          <img
            src={bundle.previewImageUrl}
            alt={bundle.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <Sparkles className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-xs text-gray-500">Style Preview</p>
            </div>
          </div>
        )}

        {/* Selected Indicator */}
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 shadow-lg"
          >
            <Check className="h-4 w-4 text-white" />
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Name */}
        <h4 className="mb-2 text-base font-semibold text-gray-900">
          {bundle.name}
        </h4>

        {/* Description */}
        <p className="mb-3 text-sm text-gray-600 line-clamp-2">
          {bundle.description}
        </p>

        {/* Color Palette Swatches */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-gray-500">
            {bundle.palette.name}
          </p>
          <div className="flex gap-2">
            {bundle.palette.swatches.slice(0, 5).map((swatch) => (
              <div
                key={swatch.name}
                className="group/swatch relative"
                title={`${swatch.name}: ${swatch.hex}`}
              >
                <div
                  className="h-8 w-8 rounded-md border border-gray-300 shadow-sm transition-transform group-hover/swatch:scale-110"
                  style={{ backgroundColor: swatch.hex }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {bundle.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Select Button (visible on hover or when selected) */}
      <div
        className={`
          border-t border-gray-200 px-4 py-3 transition-all
          ${
            isSelected
              ? "bg-indigo-500 text-white"
              : "bg-gray-50 text-gray-700 group-hover:bg-indigo-50"
          }
        `}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-semibold">
          {isSelected ? (
            <>
              <Check className="h-4 w-4" />
              <span>Selected</span>
            </>
          ) : (
            <span>Select this style</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
