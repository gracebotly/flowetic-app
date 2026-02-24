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
  charts?: Array<{ type: string; bestFor: string }>;
}

interface DesignSystemCardProps {
  system: DesignSystem;
  onSelect: () => void;
  onRegenerate: () => void;
}

export function DesignSystemCard({ system, onSelect, onRegenerate }: DesignSystemCardProps) {
  const colorSwatches = system.colors.split('/').map(c => c.trim()).filter(Boolean);
  const [headingFont, bodyFont] = system.typography.split('+').map(f => f.trim());

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="h-2 flex">
        {colorSwatches.map((color, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
            <Palette size={18} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 leading-tight">{system.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{system.style}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Palette</span>
          <div className="flex gap-2">
            {colorSwatches.map((color, i) => (
              <div key={i} className="group relative">
                <div
                  className="h-10 w-10 rounded-lg border border-gray-200 transition-transform duration-200 hover:scale-110 cursor-pointer"
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {color}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Typography</span>
          <div className="rounded-lg bg-gray-50 p-3 space-y-1">
            <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: headingFont }}>
              {headingFont || 'Heading Font'}
            </p>
            <p className="text-xs text-gray-600" style={{ fontFamily: bodyFont }}>
              {bodyFont || 'Body Font'} — The quick brown fox jumps over the lazy dog
            </p>
          </div>
        </div>

        {system.charts && system.charts.filter(c => c.type && c.type !== 'Unknown').length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Charts</span>
            <div className="flex flex-wrap gap-1.5">
              {system.charts.filter(c => c.type && c.type !== 'Unknown').map((chart, i) => (
                <span key={i} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                  {chart.type}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-700">Best for:</span> {system.bestFor}
        </p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onSelect}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-indigo-700 cursor-pointer"
          >
            <Check size={16} />
            Use This Design
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
