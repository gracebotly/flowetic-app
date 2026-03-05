'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  DonutChart,
  BarChart,
  LineChart,
  Card,
  Metric,
  Text,
  Flex,
  Badge,
  BadgeDelta,
  Title,
  Grid,
} from '@tremor/react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Phone,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import type { SkeletonData } from '@/lib/portals/transformData';

interface VoicePerformanceProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

// ── Animation Variants ────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const expandVariant = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
};

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'success' || status === 'completed';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      isSuccess
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    }`}>
      {isSuccess
        ? <CheckCircle2 className="h-3 w-3" />
        : <XCircle className="h-3 w-3" />
      }
      {isSuccess ? 'Completed' : 'Failed'}
    </span>
  );
}

// ── Sentiment Badge ───────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: string }) {
  const lower = sentiment.toLowerCase();
  const styles = lower === 'positive'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : lower === 'negative'
    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {sentiment}
    </span>
  );
}

// ── Transcript Viewer ─────────────────────────────────────────
function TranscriptViewer({ transcript, callSummary, callId }: {
  transcript: string;
  callSummary: string;
  callId: string;
}) {
  const handleDownload = useCallback(() => {
    const content = [
      `Call ID: ${callId}`,
      callSummary ? `\nSummary:\n${callSummary}` : '',
      `\nTranscript:\n${transcript}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${callId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, callSummary, callId]);

  return (
    <motion.div
      variants={expandVariant}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        {/* Summary */}
        {callSummary && (
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <MessageSquare className="h-3 w-3" />
              Summary
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {callSummary}
            </p>
          </div>
        )}

        {/* Transcript */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FileText className="h-3 w-3" />
              Transcript
            </div>
            <button
              onClick={handleDownload}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-600"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md bg-white p-3 font-mono text-xs leading-relaxed text-slate-600 shadow-inner dark:bg-slate-900 dark:text-slate-300">
            {transcript || 'No transcript available'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Call Row Component ─────────────────────────────────────────
function CallRow({ row, hasSentiment }: {
  row: Record<string, unknown>;
  hasSentiment: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const transcript = String(row.transcript || '');
  const callSummary = String(row.callSummary || '');
  const hasContent = transcript.length > 0 || callSummary.length > 0;

  return (
    <div className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className={`w-full text-left transition-colors ${
          hasContent ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'cursor-default'
        } ${expanded ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Status icon */}
          <div className="flex-shrink-0">
            {String(row.status) === 'success' || String(row.status) === 'completed'
              ? <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40"><Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
              : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40"><Phone className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
            }
          </div>

          {/* Main info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {String(row.assistant)}
              </span>
              <StatusBadge status={String(row.status)} />
              {hasSentiment && Boolean(row.sentiment) && String(row.sentiment) !== '—' && (
                <SentimentBadge sentiment={String(row.sentiment)} />
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {String(row.duration)}
              </span>
              <span className="inline-flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {String(row.cost)}
              </span>
              <span>{String(row.endedReason)}</span>
            </div>
          </div>

          {/* Time + expand */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">{String(row.time)}</span>
            {hasContent && (
              expanded
                ? <ChevronUp className="h-4 w-4 text-slate-400" />
                : <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expandable transcript */}
      <AnimatePresence>
        {expanded && hasContent && (
          <div className="px-4 pb-4">
            <TranscriptViewer
              transcript={transcript}
              callSummary={callSummary}
              callId={String(row.id)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export function VoicePerformanceSkeleton({ data, branding }: VoicePerformanceProps) {
  const { headline, kpis, trend, recentRows, endedReasonBreakdown, assistantBreakdown, sentimentBreakdown, costTrend } = data;
  const hasSentiment = recentRows.some(r => r.sentiment && String(r.sentiment) !== '—');
  const hasTranscripts = recentRows.some(r => String(r.transcript || '').length > 0 || String(r.callSummary || '').length > 0);

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Headline Block ─── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <Card className="relative overflow-hidden">
          {/* Accent gradient bar */}
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color})` }}
          />
          <Flex justifyContent="between" alignItems="center" className="pt-2">
            <div>
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Performance Summary
              </Text>
              <Metric className="mt-1">
                {headline.total.toLocaleString()} {headline.totalLabel}
              </Metric>
              <Text className="mt-1 text-tremor-default text-tremor-content">
                {headline.periodLabel}
              </Text>
            </div>
            {headline.percentChange !== null && (
              <div className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold ${
                headline.percentChange >= 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}>
                {headline.percentChange >= 0 ? '↑' : '↓'}
                {' '}{headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
              </div>
            )}
          </Flex>
        </Card>
      </motion.div>

      {/* ─── Section 2: KPI Cards ─── */}
      <Grid numItemsMd={3} className="gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
            <Card className="relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{
                  backgroundColor: kpi.color === 'green' ? '#10B981'
                    : kpi.color === 'red' ? '#EF4444'
                    : kpi.color === 'blue' ? '#3B82F6'
                    : kpi.color === 'amber' ? '#F59E0B'
                    : '#94A3B8',
                }}
              />
              <div className="pl-3">
                <Text className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {kpi.label}
                </Text>
                <Flex justifyContent="between" alignItems="baseline" className="mt-2">
                  <Metric>{kpi.value}</Metric>
                  {kpi.trendValue && (
                    <BadgeDelta
                      deltaType={kpi.trend === 'up' ? 'increase' : 'decrease'}
                      size="sm"
                    >
                      {kpi.trendValue}
                    </BadgeDelta>
                  )}
                </Flex>
              </div>
            </Card>
          </motion.div>
        ))}
      </Grid>

      {/* ─── Section 3: Call Volume Trend ─── */}
      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <Card>
            <Title>Call Volume</Title>
            <Text>Daily calls over the last 30 days</Text>
            <AreaChart
              className="mt-4 h-72"
              data={trend}
              index="date"
              categories={['successCount', 'failCount']}
              colors={['emerald', 'rose']}
              valueFormatter={(v: number) => v.toLocaleString()}
              showLegend
              showAnimation
              curveType="monotone"
            />
          </Card>
        </motion.div>
      )}

      {/* ─── Section 4: Ended Reason + Assistant Breakdown ─── */}
      <Grid numItemsMd={2} className="gap-4">
        {endedReasonBreakdown && endedReasonBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <Card>
              <Title>Why Calls End</Title>
              <Text>Distribution of call termination reasons</Text>
              <DonutChart
                className="mt-4 h-52"
                data={endedReasonBreakdown}
                category="count"
                index="reason"
                colors={['blue', 'cyan', 'emerald', 'amber', 'rose', 'violet', 'slate']}
                showAnimation
                variant="pie"
              />
            </Card>
          </motion.div>
        )}

        {assistantBreakdown && assistantBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <Card>
              <Title>Agent Performance</Title>
              <Text>Calls handled per assistant</Text>
              <BarChart
                className="mt-4 h-52"
                data={assistantBreakdown}
                index="name"
                categories={['count']}
                colors={['blue']}
                valueFormatter={(v: number) => v.toLocaleString()}
                showAnimation
              />
            </Card>
          </motion.div>
        )}
      </Grid>

      {/* ─── Section 5: Sentiment + Cost Trend ─── */}
      <Grid numItemsMd={2} className="gap-4">
        {sentimentBreakdown && sentimentBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
            <Card>
              <Title>Caller Sentiment</Title>
              <Text>Emotional tone of conversations</Text>
              <DonutChart
                className="mt-4 h-52"
                data={sentimentBreakdown}
                category="count"
                index="sentiment"
                colors={['emerald', 'amber', 'rose']}
                showAnimation
              />
            </Card>
          </motion.div>
        )}

        {costTrend && costTrend.length > 1 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
            <Card>
              <Title>Cost Trend</Title>
              <Text>Daily spend and per-call cost</Text>
              <LineChart
                className="mt-4 h-52"
                data={costTrend}
                index="date"
                categories={['totalCost', 'avgCost']}
                colors={['blue', 'cyan']}
                valueFormatter={(v: number) => `$${v.toFixed(2)}`}
                showLegend
                showAnimation
                curveType="monotone"
              />
            </Card>
          </motion.div>
        )}
      </Grid>

      {/* ─── Section 6: Recent Calls (Card-based with transcript viewer) ─── */}
      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={9}>
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <Title className="!mb-0">Recent Calls</Title>
                <Text className="mt-0.5">
                  {hasTranscripts
                    ? 'Click a call to view transcript and summary'
                    : `Last ${recentRows.length} calls`
                  }
                </Text>
              </div>
              {hasTranscripts && (
                <Badge size="xs" color="blue">
                  <FileText className="mr-1 inline h-3 w-3" />
                  Transcripts available
                </Badge>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentRows.map((row) => (
                <CallRow
                  key={String(row.id)}
                  row={row as Record<string, unknown>}
                  hasSentiment={hasSentiment}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
