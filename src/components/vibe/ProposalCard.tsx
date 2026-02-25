'use client';

import React from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Proposal } from '@/types/proposal';
import { WireframeThumbnail } from './WireframeThumbnail';

interface ProposalCardProps {
  proposal: Proposal;
  isSelected: boolean;
  onSelect: () => Promise<void> | void;
  animationDelay?: number;
}

/** WCAG AA text color selection */
function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0F172A' : '#FFFFFF';
}

/** Dominant label from emphasis blend */
function getEmphasisLabel(blend: Proposal['emphasisBlend']): string {
  if (blend.dashboard >= blend.product && blend.dashboard >= blend.analytics) return 'Ops-focused';
  if (blend.product >= blend.analytics) return 'Client-facing';
  return 'Analytics-heavy';
}

export function ProposalCard({ proposal, isSelected, onSelect, animationDelay = 0 }: ProposalCardProps) {
  const [showReasoning, setShowReasoning] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const ds = proposal.designSystem;
  const colors = ds.colors;
  const primaryText = getContrastText(colors.primary);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animationDelay, ease: 'easeOut' }}
      className={`
        relative rounded-xl border-2 overflow-hidden cursor-pointer
        transition-all duration-200
        ${isSelected
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/30'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }
      `}
      onClick={onSelect}
    >
      <div className="aspect-[16/10] w-full overflow-hidden">
        <WireframeThumbnail
          components={proposal.wireframeLayout.components}
          colors={{
            primary: colors.primary,
            secondary: colors.secondary,
            accent: colors.accent,
            background: colors.background,
            text: colors.text,
          }}
        />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{proposal.title}</h3>
          <span
            className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${colors.primary}18`,
              color: colors.primary,
            }}
          >
            {getEmphasisLabel(proposal.emphasisBlend)}
          </span>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{proposal.pitch}</p>

        <div className="flex items-center gap-1.5">
          {[colors.primary, colors.secondary, colors.accent].filter(Boolean).map((color, i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-md border border-gray-200"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          <span className="ml-2 text-[10px] text-gray-400 font-mono" style={{ color: primaryText }}>
            {ds.fonts.heading.split(',')[0]}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowReasoning(!showReasoning);
          }}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          {showReasoning ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Why this design?
        </button>

        {showReasoning && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-2"
          >
            {proposal.reasoning}
          </motion.p>
        )}

        <button
          type="button"
          disabled={isSelected || isProcessing}
          onClick={async (e) => {
            e.stopPropagation();

            if (isSelected || isProcessing) return;

            setIsProcessing(true);
            try {
              await onSelect();
            } finally {
              // Keep processing state for 500ms to prevent double-clicks
              setTimeout(() => setIsProcessing(false), 500);
            }
          }}
          className={`
            w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
            transition-colors duration-200
            ${isSelected || isProcessing
              ? 'bg-indigo-600 text-white cursor-default opacity-90'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
            }
          `}
        >
          <Check size={14} />
          {isSelected ? 'Selected' : isProcessing ? 'Selecting...' : 'Choose This'}
        </button>
      </div>
    </motion.div>
  );
}
