'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Layers,
  Loader2,
  Mic,
  Phone,
  XCircle,
} from 'lucide-react';
import { HealthBanner, type EntityHealth } from './shared/HealthBanner';
import { MetricsBar, type MetricKPI } from './shared/MetricsBar';
import { deriveEntityHealth } from './shared/deriveEntityHealth';
import { CallRow, type CallData } from './shared/CallRow';

interface VoiceDetailPanelProps {
  platform: 'retell' | 'vapi';
  sourceId: string;
  externalId: string;
  onHealthChange?: (health: EntityHealth) => void;
}

interface VapiDetailData {
  ok: boolean;
  details: Record<string, unknown> | null;
  stats: {
    totalEvents: number;
    successEvents: number;
    successRate: number;
    avgDuration: number;
    totalCost: number;
    latestError?: string | null;
  };
  error?: string;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}


function computeSparkData(items: Array<{ timestamp: number | string }>, days = 7): { idx: string; value: number }[] {
  const now = new Date();
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const counts = new Map<string, number>();
  buckets.forEach((b) => counts.set(b, 0));
  items.forEach((item) => {
    const day = new Date(item.timestamp).toISOString().slice(0, 10);
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  return buckets.map((b, i) => ({ idx: String(i), value: counts.get(b) ?? 0 }));
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | undefined | null;
}) {
  const display = value === undefined || value === null || value === '' ? '—' : String(value);
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="mt-0.5 text-sm font-medium text-gray-900">{display}</div>
      </div>
    </div>
  );
}

export function VapiDetailPanel({ sourceId, externalId, onHealthChange }: VoiceDetailPanelProps) {
  const [data, setData] = useState<VapiDetailData | null>(null);
  const [calls, setCalls] = useState<CallData[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);
  const [callsLimit, setCallsLimit] = useState(5);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch(`/api/connections/entity-details?source_id=${sourceId}&external_id=${externalId}&platform=vapi`).then((res) => res.json()),
      fetch(`/api/connections/entity-calls/vapi?source_id=${sourceId}&assistant_id=${externalId}&limit=${callsLimit}`).then((res) => res.json()),
    ])
      .then(([detailsJson, callsJson]) => {
        if (!mounted) return;
        setData(detailsJson);
        setCalls(Array.isArray(callsJson?.calls) ? callsJson.calls : []);
      })
      .catch(() => {
        if (!mounted) return;
        setData({
          ok: false,
          details: null,
          stats: { totalEvents: 0, successEvents: 0, successRate: 0, avgDuration: 0, totalCost: 0, latestError: null },
          error: 'Unknown error',
        });
        setCalls([]);
      })
      .finally(() => {
        if (mounted) setCallsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [callsLimit, externalId, sourceId]);

  const health = useMemo(() => {
    // If Supabase stats are empty but we have calls from the platform API, use call data for health
    const stats = data?.stats ?? null;
    if (stats && stats.totalEvents === 0 && calls.length > 0) {
      const successCalls = calls.filter((c) => c.status === 'success' || c.status === 'ended').length;
      const total = calls.length;
      const enrichedStats = {
        totalEvents: total,
        successEvents: successCalls,
        successRate: total > 0 ? Math.round((successCalls / total) * 100) : 0,
        avgDuration: 0,
        totalCost: 0,
        latestError: stats.latestError,
      };
      return deriveEntityHealth(enrichedStats, data?.error ?? null);
    }
    const h = deriveEntityHealth(stats, data?.error ?? null);
    return h.status === 'no-data' ? { ...h, entityKind: 'agent' } : h;
  }, [data?.error, data?.stats, calls]);

  useEffect(() => {
    if (data) onHealthChange?.(health);
  }, [data, health, onHealthChange]);

  const sparkData = useMemo(() => computeSparkData(calls), [calls]);

  const kpis: MetricKPI[] = useMemo(() => {
    let stats = data?.stats ?? { totalEvents: 0, successRate: 0, avgDuration: 0, totalCost: 0 };
    if (stats.totalEvents === 0 && calls.length > 0) {
      const successCount = calls.filter((c) => c.status === 'success' || c.status === 'ended').length;
      const total = calls.length;
      stats = {
        ...stats,
        totalEvents: total,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
      };
    }
    return [
      {
        label: 'Calls',
        value: `${stats.totalEvents}`,
        icon: Phone,
        accent: '',
        sparkData,
        sparkColor: 'blue',
      },
      {
        label: 'Success Rate',
        value: `${stats.successRate}%`,
        icon: stats.successRate === 0 && stats.totalEvents > 0 ? XCircle : stats.successRate < 80 ? AlertTriangle : CheckCircle2,
        accent: stats.totalEvents === 0 ? '' : stats.successRate === 0 ? 'red' : stats.successRate < 80 ? 'amber' : 'green',
      },
      {
        label: 'Avg Duration',
        value: formatDuration(Math.round(stats.avgDuration / 1000)),
        icon: Clock,
        accent: '',
      },
      {
        label: 'Total Cost',
        value: `$${Number(stats.totalCost ?? 0).toFixed(2)}`,
        icon: DollarSign,
        accent: '',
        tooltip: 'Agency platform cost — not visible to clients',
      },
    ];
  }, [data?.stats, sparkData, calls]);

  const hasMore = callsLimit < 10 && calls.length >= callsLimit;

  return (
    <div className="space-y-5">
      <HealthBanner health={health} platformLabel="Vapi" />
      <MetricsBar kpis={kpis} />

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Calls</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{calls.length} calls</span>
          </div>
        </div>
        {callsLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading calls...
          </div>
        ) : null}
        {!callsLoading && calls.length === 0 ? <div className="py-4 text-sm text-gray-400">No calls recorded yet.</div> : null}
        <div className="space-y-1">
          {calls.map((call) => <CallRow key={call.id} call={call} platform="vapi" />)}
        </div>
        {hasMore ? (
          <button
            type="button"
            onClick={() => { setCallsLoading(true); setCallsLimit(10); }}
            className="mt-3 cursor-pointer rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50"
          >
            Load More
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <button
          type="button"
          onClick={() => setIsConfigOpen((prev) => !prev)}
          className="flex w-full cursor-pointer items-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors duration-200 hover:text-gray-600"
        >
          {isConfigOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Assistant Configuration
        </button>

        <AnimatePresence initial={false}>
          {isConfigOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
              className="overflow-hidden"
            >
              {data?.details ? (
                <div className="space-y-1 divide-y divide-gray-50 pt-2">
                  <DetailRow icon={Brain} label="LLM" value={`${data.details.llm_provider ?? '—'} / ${data.details.llm_model ?? '—'}`} />
                  <DetailRow icon={Mic} label="Voice" value={`${data.details.voice_provider ?? '—'} / ${data.details.voice_id ?? '—'}`} />
                  <DetailRow icon={Layers} label="Tools Attached" value={`${data.details.tool_count ?? 0} tools`} />
                </div>
              ) : (
                <div className="pt-2 text-sm text-gray-400">Could not fetch live configuration from Vapi.</div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
