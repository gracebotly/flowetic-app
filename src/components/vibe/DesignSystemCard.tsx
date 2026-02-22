'use client';

import React from 'react';
import { Palette, RefreshCw, Check } from 'lucide-react';

interface DesignSystem {
  id: string;
  name: string;
  icon: string;
  colors: string;
  style: string;
  typography: string;
  bestFor: string;
}

interface DesignSystemCardProps {
  system: DesignSystem;
  onSelect: () => void;
  onRegenerate: () => void;
}

export function DesignSystemCard({ system, onSelect, onRegenerate }: DesignSystemCardProps) {
  const colorSwatches = system.colors.split('/').map(c => c.trim()).filter(Boolean);

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Palette size={18} className="text-indigo-500" />
        <h3 className="text-base font-semibold text-gray-900">{system.name}</h3>
      </div>

      {/* Color swatches */}
      <div className="mb-3 flex gap-2">
        {colorSwatches.map((color, i) => (
          <div
            key={i}
            className="h-8 w-8 rounded-lg border border-gray-200"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Details */}
      <div className="mb-4 space-y-1 text-sm text-gray-600">
        <p><span className="font-medium text-gray-700">Style:</span> {system.style}</p>
        <p><span className="font-medium text-gray-700">Typography:</span> {system.typography}</p>
        <p><span className="font-medium text-gray-700">Best for:</span> {system.bestFor}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSelect}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Check size={16} />
          Use This Design
        </button>
        <button
          onClick={onRegenerate}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Generate New
        </button>
      </div>
    </div>
  );
}
