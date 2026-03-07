'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

export interface ExecutionData {
  id: string;
  status: 'success' | 'error' | 'waiting';
  duration: number | null;
  operations?: number;
  centicredits?: number;
  mode?: string;
  timestamp: string;
  errorName?: string | null;
  errorMessage?: string | null;
}

interface ExecutionRowProps {
  execution: ExecutionData;
  platform: 'make' | 'n8n';
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function trimError(msg: string | null | undefined) {
  if (!msg) return '';
  return msg.length > 60 ? `${msg.slice(0, 60)}…` : msg;
}

export function ExecutionRow({ execution, platform }: ExecutionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = execution.status === 'error';
  const isWaiting = execution.status === 'waiting';

  return (
    <div className={`border-b border-gray-50 ${isError ? 'border-l-2 border-l-red-300 pl-2' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-200 hover:bg-gray-50"
      >
        {execution.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
        {isError ? <XCircle className="h-4 w-4 text-red-500" /> : null}
        {isWaiting ? <Clock className="h-4 w-4 text-amber-500" /> : null}

        <span className="text-sm font-medium text-gray-900">{formatDuration(execution.duration)}</span>
        {platform === 'make' ? <span className="text-xs text-gray-500">{execution.operations ?? 0} ops</span> : null}
        {platform === 'make' ? <span className="text-xs text-gray-500">{((execution.centicredits ?? 0) / 100).toFixed(2)} cr</span> : null}

        <span className={`min-w-0 flex-1 truncate text-sm ${isError ? 'text-red-600' : 'text-gray-500'}`}>
          {isError ? trimError(execution.errorMessage) || 'Execution failed' : 'Execution completed'}
        </span>

        <span className="shrink-0 text-xs text-gray-400">{formatRelative(execution.timestamp)}</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-3 pb-4 text-xs text-gray-600">
              {isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-red-700"><AlertTriangle className="h-3.5 w-3.5" />Error</div>
                  <div className="font-medium text-red-800">{execution.errorName ?? 'Execution Error'}</div>
                  <div className="mt-1 text-red-700">{execution.errorMessage ?? 'No error message available.'}</div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-100 p-3">
                <div><span className="text-gray-400">Duration:</span> {formatDuration(execution.duration)}</div>
                {platform === 'make' ? <div><span className="text-gray-400">Operations:</span> {execution.operations ?? 0}</div> : null}
                {platform === 'make' ? <div><span className="text-gray-400">Centicredits:</span> {execution.centicredits ?? 0}</div> : null}
                {platform === 'n8n' ? <div><span className="text-gray-400">Mode:</span> {execution.mode ?? '—'}</div> : null}
                <div className="col-span-2 truncate font-mono text-[11px] text-gray-500">Execution ID: {execution.id}</div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
