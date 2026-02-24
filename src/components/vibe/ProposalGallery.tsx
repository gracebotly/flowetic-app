'use client';

import React from 'react';
import type { ProposalsPayload } from '@/types/proposal';
import { ProposalCard } from './ProposalCard';
import { ProposalLoadingState } from './ProposalLoadingState';

interface ProposalGalleryProps {
  payload: ProposalsPayload | null;
  isLoading: boolean;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function ProposalGallery({ payload, isLoading, selectedIndex, onSelect }: ProposalGalleryProps) {
  if (isLoading || !payload) {
    return <ProposalLoadingState />;
  }

  const proposals = payload.proposals || [];

  if (proposals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <p className="text-sm text-gray-500">No proposals available yet.</p>
          <p className="text-xs text-gray-400 mt-1">Ask me to generate some options!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {selectedIndex !== null ? 'Your Selected Proposal' : 'Choose a Proposal'}
        </h2>
        <span className="text-xs text-gray-400">
          {proposals.length} option{proposals.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={`grid gap-4 ${proposals.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
        {proposals.map((proposal, i) => (
          <ProposalCard
            key={proposal.index}
            proposal={proposal}
            isSelected={selectedIndex === proposal.index}
            onSelect={() => onSelect(proposal.index)}
            animationDelay={i * 0.12}
          />
        ))}
      </div>
    </div>
  );
}
