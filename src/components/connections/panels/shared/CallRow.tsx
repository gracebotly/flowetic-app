'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Smile,
  Meh,
  Frown,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import { RecordingPlayer } from './RecordingPlayer';
import { TranscriptViewer } from './TranscriptViewer';

export interface CallData {
  id: string;
  callType: string;
  status: string;
  duration: number;
  sentiment: string;
  summary: string;
  transcript: string;
  recordingUrl: string | null;
  stereoRecordingUrl?: string;
  assistantRecordingUrl?: string;
  customerRecordingUrl?: string;
  costTotal: number;
  costBreakdown: Array<{ label: string; cost: number }>;
  disconnectionReason: string;
  timestamp: number;
  customAnalysisData?: Record<string, unknown> | null;
  structuredData?: Record<string, unknown> | null;
  successEvaluation?: string | null;
}

interface CallRowProps {
  call: CallData;
  platform: 'retell' | 'vapi';
}

function formatCallType(raw: string): string {
  if (!raw) return 'Unknown';
  if (raw === 'web_call' || raw === 'webCall') return 'Web';
  if (raw === 'phone_call' || raw === 'inboundPhoneCall') return 'Inbound';
  if (raw === 'outboundPhoneCall') return 'Outbound';
  return raw;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}m ${rem}s`;
}

function formatRelative(ts: number): string {
  const delta = Date.now() - ts;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDisconnection(reason: string): string {
  if (!reason) return 'No disconnection reason reported';
  return reason.replace(/_/g, ' ');
}

function toPairs(data?: Record<string, unknown> | null) {
  if (!data) return [];
  return Object.entries(data).filter(([, value]) => value !== null && value !== undefined && String(value) !== '');
}

export function CallRow({ call, platform }: CallRowProps) {
  const [expanded, setExpanded] = useState(false);

  const sentimentIcon = useMemo(() => {
    const sentiment = call.sentiment.toLowerCase();
    if (sentiment === 'positive') return <Smile className="h-4 w-4 text-emerald-500" />;
    if (sentiment === 'negative') return <Frown className="h-4 w-4 text-red-500" />;
    return <Meh className="h-4 w-4 text-gray-400" />;
  }, [call.sentiment]);

  const structuredPairs = toPairs(platform === 'retell' ? call.customAnalysisData : call.structuredData);

  return (
    <div className="border-b border-gray-50">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-200 hover:bg-gray-50"
      >
        {call.status === 'ended'
          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          : <XCircle className="h-4 w-4 shrink-0 text-red-500" />}

        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
          {formatCallType(call.callType)}
        </span>

        <span className="text-sm font-medium text-gray-900">{formatDuration(call.duration)}</span>
        {sentimentIcon}

        <span className="min-w-0 flex-1 truncate text-sm text-gray-500">{call.summary || 'No summary available'}</span>

        <span className="shrink-0 text-xs text-gray-400">{formatRelative(call.timestamp)}</span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-gray-300" />
          : <ChevronDown className="h-4 w-4 text-gray-300" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 pb-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <FileText className="h-3.5 w-3.5" />
                  AI Summary
                </div>
                <div className="text-sm text-gray-700">{call.summary || 'No AI summary available.'}</div>
              </div>

              {call.recordingUrl ? (
                <RecordingPlayer
                  url={call.recordingUrl}
                  stereoUrl={call.stereoRecordingUrl}
                  assistantUrl={call.assistantRecordingUrl}
                  customerUrl={call.customerRecordingUrl}
                />
              ) : null}

              {call.transcript ? <TranscriptViewer transcript={call.transcript} agentName="Agent" /> : null}

              <div className="rounded-lg border border-gray-100 p-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">Cost Breakdown</div>
                <div className="space-y-1 text-xs text-gray-600">
                  {call.costBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span>${item.cost.toFixed(4)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 font-semibold text-gray-900">
                    <span>Total</span>
                    <span>${call.costTotal.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {structuredPairs.length > 0 || call.successEvaluation ? (
                <div className="rounded-lg border border-gray-100 p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                    {platform === 'retell' ? 'Call Analysis Data' : 'Structured Data'}
                  </div>
                  <dl className="space-y-1 text-xs">
                    {structuredPairs.map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3">
                        <dt className="text-gray-400">{key}</dt>
                        <dd className="text-right text-gray-700">{String(value)}</dd>
                      </div>
                    ))}
                    {call.successEvaluation ? (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-gray-400">successEvaluation</dt>
                        <dd className="text-right text-gray-700">{call.successEvaluation}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              <div className="text-xs text-gray-400">Disconnection reason: {formatDisconnection(call.disconnectionReason)}</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
