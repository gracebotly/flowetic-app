'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function ProposalLoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15 }}
          className="rounded-xl border border-gray-200 bg-white overflow-hidden"
        >
          <div className="aspect-[16/10] bg-gray-100 animate-pulse" />

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
            </div>
            <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-gray-100 animate-pulse" />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-6 w-6 rounded-md bg-gray-200 animate-pulse" />
              ))}
            </div>
            <div className="h-9 w-full rounded-lg bg-gray-100 animate-pulse" />
          </div>
        </motion.div>
      ))}

      <div className="col-span-full text-center py-2">
        <p className="text-sm text-gray-500">Generating tailored proposals...</p>
      </div>
    </div>
  );
}
