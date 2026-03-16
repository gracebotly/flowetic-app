'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, DonutChart, BarChart, LineChart, Flex } from '@tremor/react';
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
  Activity,
  MessageSquare,
  Headphones,
  Target,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { ThemedCard, KPICard, StatusBadge, fadeUp, hexToRgba } from '@/components/portals/shared/portalPrimitives';
import type { SkeletonData } from '@/lib/portals/transformData';
import { getThemeTokens, STATUS, DEFAULT_ACCENT, type ThemeTokens } from '@/lib/portals/themeTokens';
import { parseTranscript } from '@/lib/portals/parseTranscript';
import { SkeletonHealthBanner } from '@/components/portals/shared/SkeletonEmptyState';
import { DataFreshnessBar } from '@/components/portals/shared/DataFreshnessBar';

interface VoicePerformanceProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

const expandVariant = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
};

function formatCallType(raw: string): string {
  if (!raw) return '';
  const value = raw.trim();
  if (value === 'web_call' || value === 'webCall') return 'Web';
  if (value === 'phone_call' || value === 'inboundPhoneCall') return 'Inbound';
  if (value === 'outboundPhoneCall') return 'Outbound';
  return value;
}

function formatProductName(product: string): string {
  if (product === 'retell_voice_engine') return 'Voice Engine';
  if (product === 'elevenlabs_tts_new') return 'ElevenLabs TTS';
  if (product === 'gpt_4_1') return 'GPT-4.1';
  return product
    .split('_')
    .map((p) => (p ? `${p[0].toUpperCase()}${p.slice(1)}` : p))
    .join(' ');
}


function generateVoiceInsights(data: SkeletonData): Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string; recommendation: string }> {
  const insights: Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string; recommendation: string }> = [];
  const { headline, kpis, sentimentBreakdown, costTrend } = data;

  const failedKpi = kpis.find((k) => k.label === 'Failed');
  const failedCount = typeof failedKpi?.value === 'number' ? failedKpi.value : 0;
  const successRate = headline.total > 0 ? Math.round(((headline.total - failedCount) / headline.total) * 100) : 0;

  if (successRate >= 95) {
    insights.push({
      type: 'success',
      title: 'Strong call completion rate',
      description: `${successRate}% of calls completed successfully`,
      recommendation: 'Agent performance is excellent — consider expanding to new use cases',
    });
  } else if (successRate < 80) {
    insights.push({
      type: 'warning',
      title: 'High call failure rate',
      description: `${failedCount} calls failed out of ${headline.total} total`,
      recommendation: 'Review agent prompts and disconnection reasons',
    });
  }

  if (sentimentBreakdown && sentimentBreakdown.length > 0) {
    const negative = sentimentBreakdown.find((s) => s.sentiment.toLowerCase() === 'negative');
    const total = sentimentBreakdown.reduce((sum, s) => sum + s.count, 0);
    if (negative && total > 0) {
      const negPct = Math.round((negative.count / total) * 100);
      if (negPct > 20) {
        insights.push({
          type: 'warning',
          title: 'Elevated negative sentiment',
          description: `${negPct}% of callers had negative sentiment`,
          recommendation: 'Review transcripts of negative calls to identify pain points',
        });
      }
    }
  }

  if (costTrend && costTrend.length >= 2) {
    const recent = costTrend[costTrend.length - 1];
    const prior = costTrend[costTrend.length - 2];
    if (recent.avgCost > prior.avgCost * 1.2) {
      insights.push({
        type: 'info',
        title: 'Average call cost increasing',
        description: `Latest avg cost $${recent.avgCost.toFixed(2)} vs $${prior.avgCost.toFixed(2)} prior period`,
        recommendation: 'Consider optimizing agent response length or switching to a more cost-effective model',
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: 'Steady voice operations',
      description: `${headline.total} calls tracked in the current period`,
      recommendation: 'Continue monitoring call summaries and sentiment for optimization opportunities',
    });
  }

  return insights.slice(0, 3);
}

function getRowString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function getKPIIcon(label: string): { icon: React.ElementType; color: string } {
  if (label === 'Total Calls') return { icon: Phone, color: 'accent' };
  if (label === 'Avg Duration') return { icon: Clock, color: STATUS.info };
  if (label === 'Avg Cost' || label === 'Total Cost') return { icon: DollarSign, color: STATUS.warning };
  if (label === 'Success Rate') return { icon: CheckCircle2, color: STATUS.success };
  if (label === 'Failed') return { icon: XCircle, color: STATUS.error };
  return { icon: Activity, color: 'accent' };
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const lower = sentiment.toLowerCase();
  const color = lower === 'positive' ? STATUS.success : lower === 'negative' ? STATUS.error : STATUS.warning;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${color}1A`, color }}>
      {sentiment}
    </span>
  );
}

function ChatBubbleTranscript({ transcript, accentColor, tokens }: { transcript: string; accentColor: string; tokens: ThemeTokens }) {
  const messages = parseTranscript(transcript);
  if (messages.length === 0) {
    return <p className="text-sm" style={{ color: tokens.textSecondary }}>No transcript available.</p>;
  }

  return (
    <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-lg p-3 [scrollbar-width:thin]" style={{ backgroundColor: tokens.bgCode, border: `1px solid ${tokens.borderCode}` }}>
      {messages.map((message, idx) => {
        const isUser = message.role === 'user';
        return (
          <div key={`${message.role}-${idx}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[80%] rounded-xl px-3 py-2 text-sm"
              style={{
                backgroundColor: isUser ? hexToRgba(accentColor, 0.1) : tokens.bgExpanded,
                color: isUser ? tokens.textPrimary : tokens.textSecondary,
                border: `1px solid ${isUser ? hexToRgba(accentColor, 0.2) : tokens.border}`,
              }}
            >
              {message.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AudioPlayer({ url, tokens }: { url: string; tokens: ThemeTokens }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: tokens.bgExpanded, border: `1px solid ${tokens.border}` }}>
      <Headphones className="h-4 w-4 flex-shrink-0" style={{ color: tokens.textSecondary }} />
      <audio controls preload="none" className="h-8 w-full" style={{ minWidth: 0 }}>
        <source src={url} type="audio/wav" />
      </audio>
    </div>
  );
}

function CostBreakdownPanel({ breakdown, tokens }: { breakdown: Array<{ product: string; cost: number; unit_price?: number }>; tokens: ThemeTokens }) {
  return (
    <div className="mt-3 rounded-lg px-4 py-3" style={{ backgroundColor: tokens.bgExpanded, border: `1px solid ${tokens.border}` }}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.textMuted }}>
        <DollarSign className="h-3 w-3" /> Cost Breakdown
      </div>
      <div className="mt-2 space-y-1">
        {breakdown.map((item, i) => (
          <div key={`${item.product}-${i}`} className="flex items-center justify-between text-xs">
            <span style={{ color: tokens.textSecondary }}>{formatProductName(item.product)}</span>
            <span className="font-medium" style={{ color: tokens.textPrimary }}>${(item.cost / 100).toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallRow({ row, hasSentiment, accentColor }: { row: Record<string, unknown>; hasSentiment: boolean; accentColor: string }) {
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const [expanded, setExpanded] = useState(false);

  const transcript = getRowString(row, 'transcript');
  const callSummary = getRowString(row, 'callSummary', 'call_summary');
  const recordingUrl = getRowString(row, 'recording_url', 'recordingUrl');
  const callType = getRowString(row, 'call_type', 'callType');
  const sentiment = getRowString(row, 'sentiment');
  const hasContent = transcript.length > 0 || callSummary.length > 0 || recordingUrl.length > 0;

  const rawBreakdown = row.cost_breakdown;
  const breakdown = Array.isArray(rawBreakdown)
    ? rawBreakdown.filter((item): item is { product: string; cost: number; unit_price?: number } => {
      return typeof item === 'object' && item !== null && typeof (item as { product?: unknown }).product === 'string' && typeof (item as { cost?: unknown }).cost === 'number';
    })
    : [];

  const handleDownload = useCallback(() => {
    const content = [
      `Call ID: ${String(row.id || '')}`,
      callSummary ? `\nSummary:\n${callSummary}` : '',
      `\nTranscript:\n${transcript}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${String(row.id || 'call')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [callSummary, row.id, transcript]);

  const isSuccess = String(row.status) === 'success' || String(row.status) === 'completed';

  return (
    <div style={{ borderBottom: `1px solid ${tokens.border}` }}>
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className="w-full text-left transition-colors"
        style={{
          cursor: hasContent ? 'pointer' : 'default',
          backgroundColor: expanded ? tokens.bgExpanded : 'transparent',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: isSuccess ? `${STATUS.success}1A` : `${STATUS.error}1A` }}>
            <Phone className="h-4 w-4" style={{ color: isSuccess ? STATUS.success : STATUS.error }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium" style={{ color: tokens.textPrimary }}>{String(row.assistant)}</span>
              <StatusBadge status={String(row.status)} />
              {hasSentiment && sentiment && sentiment !== '—' && <SentimentBadge sentiment={sentiment} />}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(row.call_successful === true) && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${STATUS.success}15`, color: STATUS.success }}>
                  <Target className="h-3 w-3" /> Goal Met
                </span>
              )}
              {(row.call_successful === false) && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${STATUS.error}15`, color: STATUS.error }}>
                  <Target className="h-3 w-3" /> Goal Missed
                </span>
              )}
              {callType && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${STATUS.info}15`, color: STATUS.info }}>
                  {formatCallType(callType)}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: tokens.textSecondary }}>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{String(row.duration)}</span>
              <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />{String(row.cost)}</span>
              <span>{String(row.endedReason)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: tokens.textMuted }}>{String(row.time)}</span>
            {hasContent && (expanded ? <ChevronUp className="h-4 w-4" style={{ color: tokens.textMuted }} /> : <ChevronDown className="h-4 w-4" style={{ color: tokens.textMuted }} />)}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && hasContent && (
          <motion.div variants={expandVariant} initial="hidden" animate="visible" exit="exit" className="overflow-hidden px-4 pb-4">
            <div className="rounded-lg px-4 py-3" style={{ backgroundColor: tokens.bgExpanded, border: `1px solid ${tokens.border}` }}>
              {callSummary && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.textMuted }}>
                    <MessageSquare className="h-3 w-3" /> Summary
                  </div>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: tokens.textSecondary }}>{callSummary}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.textMuted }}>
                  <FileText className="h-3 w-3" /> Transcript
                </div>
                {transcript && (
                  <button
                    onClick={handleDownload}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                    style={{ backgroundColor: tokens.bgCard, color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}
                  >
                    <Download className="h-3 w-3" /> Download
                  </button>
                )}
              </div>

              <ChatBubbleTranscript transcript={transcript} accentColor={accentColor} tokens={tokens} />
              {recordingUrl && <AudioPlayer url={recordingUrl} tokens={tokens} />}
              {breakdown.length > 0 && <CostBreakdownPanel breakdown={breakdown} tokens={tokens} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function VoicePerformanceSkeleton({ data, branding }: VoicePerformanceProps) {
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const accentColor = branding.primary_color || DEFAULT_ACCENT;

  const {
    headline,
    kpis,
    trend,
    recentRows,
    endedReasonBreakdown,
    assistantBreakdown,
    sentimentBreakdown,
    costTrend,
  } = data;

  const hasSentiment = recentRows.some((r) => r.sentiment && String(r.sentiment) !== '—');
  const hasTranscripts = recentRows.some((r) => String(r.transcript || '').length > 0 || String(r.callSummary || '').length > 0);
  const insights = generateVoiceInsights(data);

  // Early return for no-data state
  if (data.health.status === 'no-data') {
    return (
      <div className="space-y-6">
        <SkeletonHealthBanner health={data.health} entityType="voice" isAgencyView={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health banners — show degraded/critical/sparse states */}
      {(data.health.status === 'critical' || data.health.status === 'degraded' || data.health.status === 'sparse') && (
        <SkeletonHealthBanner health={data.health} entityType="voice" isAgencyView={false} />
      )}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={accentColor}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accentColor}, ${branding.secondary_color || accentColor})` }} />
          <Flex justifyContent="between" alignItems="center" className="pt-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Performance Summary</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>{headline.total.toLocaleString()} {headline.totalLabel}</h2>
              <p className="mt-1 text-sm" style={{ color: tokens.textSecondary }}>{headline.periodLabel}</p>
            </div>
            {headline.percentChange !== null && (
              <div className="rounded-lg px-3 py-2 text-sm font-bold" style={{ backgroundColor: headline.percentChange >= 0 ? `${STATUS.success}1A` : `${STATUS.error}1A`, color: headline.percentChange >= 0 ? STATUS.success : STATUS.error }}>
                {headline.percentChange >= 0 ? '↑' : '↓'} {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
              </div>
            )}
          </Flex>
        </ThemedCard>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.slice(0, 4).map((kpi, i) => {
          const { icon, color } = getKPIIcon(kpi.label);
          const iconColor = color === 'accent' ? accentColor : color;
          return (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={icon}
              color={iconColor}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
              index={i + 1}
            />
          );
        })}
      </div>

      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
          <ThemedCard>
            <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Call Volume Trend</h3>
            <p className="text-sm" style={{ color: tokens.textSecondary }}>Daily calls over the last 30 days</p>
            <AreaChart className="mt-4 h-72" data={trend} index="date" categories={['successCount', 'failCount']} colors={['emerald', 'rose']} valueFormatter={(v: number) => v.toLocaleString()} showLegend showAnimation curveType="monotone" />
          </ThemedCard>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {endedReasonBreakdown && endedReasonBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <ThemedCard>
              <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Why Calls End</h3>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>Distribution of call termination reasons</p>
              <DonutChart className="mt-4 h-52" data={endedReasonBreakdown} category="count" index="reason" colors={['blue', 'cyan', 'emerald', 'amber', 'rose', 'violet', 'slate']} showAnimation variant="pie" />
            </ThemedCard>
          </motion.div>
        )}

        {assistantBreakdown && assistantBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
            <ThemedCard>
              <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Agent Performance</h3>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>Calls handled per assistant</p>
              <BarChart className="mt-4 h-52" data={assistantBreakdown} index="name" categories={['count']} colors={['blue']} valueFormatter={(v: number) => v.toLocaleString()} showAnimation />
            </ThemedCard>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sentimentBreakdown && sentimentBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
            <ThemedCard>
              <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Caller Sentiment</h3>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>Emotional tone of conversations</p>
              <DonutChart className="mt-4 h-52" data={sentimentBreakdown} category="count" index="sentiment" colors={['emerald', 'amber', 'rose']} showAnimation />
            </ThemedCard>
          </motion.div>
        )}

        {costTrend && costTrend.length > 1 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={9}>
            <ThemedCard>
              <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Cost Trend</h3>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>Daily spend and per-call cost</p>
              <LineChart className="mt-4 h-52" data={costTrend} index="date" categories={['totalCost', 'avgCost']} colors={['blue', 'cyan']} valueFormatter={(v: number) => `$${v.toFixed(2)}`} showLegend showAnimation curveType="monotone" />
            </ThemedCard>
          </motion.div>
        )}
      </div>

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={10}>
        <ThemedCard>
          <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Insights</h3>
          <div className="mt-3 space-y-3">
            {insights.map((insight, index) => {
              const tone = insight.type === 'success' ? STATUS.success : insight.type === 'warning' ? STATUS.warning : STATUS.info;
              const Icon = insight.type === 'success' ? CheckCircle2 : insight.type === 'warning' ? AlertTriangle : Lightbulb;
              return (
                <div key={`${insight.title}-${index}`} className="rounded-lg border-l-4 px-3 py-2" style={{ backgroundColor: `${tone}10`, borderColor: tone }}>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: tone }}>
                    <Icon className="h-4 w-4" /> {insight.title}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: tokens.textSecondary }}>{insight.description}</p>
                  <p className="mt-1 text-xs font-medium" style={{ color: tokens.textPrimary }}>{insight.recommendation}</p>
                </div>
              );
            })}
          </div>
        </ThemedCard>
      </motion.div>

      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={11}>
          <ThemedCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${tokens.border}`, backgroundColor: tokens.headerBg }}>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>Recent Calls</h3>
                <p className="text-sm" style={{ color: tokens.textSecondary }}>
                  {hasTranscripts ? 'Click a call to view transcript, recording, and analysis' : `Last ${recentRows.length} calls`}
                </p>
              </div>
              {hasTranscripts && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium" style={{ color: STATUS.info, backgroundColor: `${STATUS.info}1A` }}>
                  <FileText className="h-3 w-3" /> Transcripts available
                </span>
              )}
            </div>

            <div>
              {recentRows.map((row) => (
                <CallRow key={String(row.id)} row={row as Record<string, unknown>} hasSentiment={hasSentiment} accentColor={accentColor} />
              ))}
            </div>
          </ThemedCard>
        </motion.div>
      )}

      {/* Data freshness */}
      <DataFreshnessBar latestEventTimestamp={recentRows[0]?.time as string} />
    </div>
  );
}
