'use client';

import { Fragment, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { parseTranscript } from '@/lib/portals/parseTranscript';

interface TranscriptViewerProps {
  transcript: string;
  agentName?: string;
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return [text];
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safe})`, 'ig');
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <mark key={`${part}-${idx}`} className="rounded bg-yellow-200">{part}</mark>;
    }
    return <Fragment key={`${part}-${idx}`}>{part}</Fragment>;
  });
}

export function TranscriptViewer({ transcript, agentName }: TranscriptViewerProps) {
  const [query, setQuery] = useState('');
  const messages = useMemo(() => parseTranscript(transcript), [transcript]);

  const matchCount = useMemo(() => {
    if (!query.trim()) return 0;
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'ig');
    return messages.reduce((count, message) => count + (message.text.match(regex)?.length ?? 0), 0);
  }, [messages, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search transcript"
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-700"
        />
      </div>
      {query.trim() ? <div className="text-xs text-gray-400">{matchCount} matches</div> : null}

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {messages.map((message, index) => {
          const isAgent = message.role === 'agent';
          return (
            <motion.div
              key={`${message.role}-${index}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[85%] rounded-lg p-3 ${
                isAgent
                  ? 'rounded-tl-sm border border-blue-100 bg-blue-50'
                  : 'rounded-tr-sm border border-gray-200 bg-gray-100'
              }`}
              >
                <div className="mb-1 text-xs font-medium text-gray-500">{isAgent ? (agentName ?? 'Agent') : 'User'}</div>
                <div className="text-sm text-gray-800">{highlightText(message.text, query)}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
