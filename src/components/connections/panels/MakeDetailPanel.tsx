'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronUp, Loader2, XCircle, Zap } from 'lucide-react';
import { HealthBanner, type EntityHealth } from './shared/HealthBanner';
import { MetricsBar, type MetricKPI } from './shared/MetricsBar';
import { deriveEntityHealth } from './shared/deriveEntityHealth';
import { ExecutionRow, type ExecutionData } from './shared/ExecutionRow';
import { IntegrationPills } from './shared/IntegrationPills';
import { ExportButton } from './shared/ExportButton';

interface MakeDetailPanelProps {
  sourceId: string;
  externalId: string;
  onHealthChange?: (health: EntityHealth) => void;
}

interface AggregateStats {
  totalExecutions: number;
  totalErrors: number;
  totalOperations: number;
  totalCenticredits: number;
}

interface MakeData {
  ok: boolean;
  details: Record<string, unknown> | null;
  stats: { totalEvents: number; successEvents: number; successRate: number; avgDuration: number; totalCost: number; latestError?: string | null };
  error?: string;
}

function computeSparkData(items: Array<{ timestamp: string }>, days = 7): { idx: string; value: number }[] {
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

export function MakeDetailPanel({ sourceId, externalId, onHealthChange }: MakeDetailPanelProps) {
  const [data, setData] = useState<MakeData | null>(null);
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(5);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`/api/connections/entity-details?source_id=${sourceId}&external_id=${externalId}&platform=make`).then((r) => r.json()),
      fetch(`/api/connections/entity-executions/make?source_id=${sourceId}&scenario_id=${externalId}&limit=${limit}`).then((r) => r.json()),
    ]).then(([d, e]) => {
      if (!mounted) return;
      setData(d);
      setExecutions(Array.isArray(e?.executions) ? e.executions : []);
      if (e?.aggregateStats) setAggregateStats(e.aggregateStats);
    }).catch(() => {
      if (!mounted) return;
      setData({ ok: false, details: null, stats: { totalEvents: 0, successEvents: 0, successRate: 0, avgDuration: 0, totalCost: 0 }, error: 'Unknown error' });
      setExecutions([]);
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [sourceId, externalId, limit]);

  const health = useMemo(() => {
    const stats = data?.stats ?? null;
    // Try executions from logs first
    if (stats && stats.totalEvents === 0 && executions.length > 0) {
      const successExecs = executions.filter((e) => e.status === 'success').length;
      const total = executions.length;
      const enrichedStats = {
        totalEvents: total,
        successEvents: successExecs,
        successRate: total > 0 ? Math.round((successExecs / total) * 100) : 0,
        avgDuration: 0,
        totalCost: 0,
        latestError: executions.find((e) => e.status === 'error')?.errorMessage ?? null,
      };
      return deriveEntityHealth(enrichedStats, data?.error ?? null);
    }
    // Try aggregate stats fallback
    if (stats && stats.totalEvents === 0 && executions.length === 0 && aggregateStats && aggregateStats.totalExecutions > 0) {
      const enrichedStats = {
        totalEvents: aggregateStats.totalExecutions,
        successEvents: Math.max(0, aggregateStats.totalExecutions - aggregateStats.totalErrors),
        successRate: aggregateStats.totalExecutions > 0 ? Math.round(((aggregateStats.totalExecutions - aggregateStats.totalErrors) / aggregateStats.totalExecutions) * 100) : 0,
        avgDuration: 0,
        totalCost: 0,
        latestError: null,
      };
      return deriveEntityHealth(enrichedStats, data?.error ?? null);
    }
    const h = deriveEntityHealth(stats, data?.error ?? null);
    return h.status === 'no-data' ? { ...h, entityKind: 'scenario' } : h;
  }, [data?.stats, data?.error, executions, aggregateStats]);

  useEffect(() => { if (data) onHealthChange?.(health); }, [data, health, onHealthChange]);

  const sparkData = useMemo(() => computeSparkData(executions), [executions]);

  const kpis: MetricKPI[] = useMemo(() => {
    let stats = data?.stats ?? { totalEvents: 0, successEvents: 0, successRate: 0, avgDuration: 0, totalCost: 0 };
    // Enrich from platform API execution logs when Supabase is empty
    if (stats.totalEvents === 0 && executions.length > 0) {
      const successCount = executions.filter((e) => e.status === 'success').length;
      const total = executions.length;
      stats = {
        totalEvents: total,
        successEvents: successCount,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
        avgDuration: 0,
        totalCost: 0,
      };
    }
    // Fallback: use aggregate stats from Make scenario list API
    // This covers webhook-triggered scenarios where the logs endpoint returns nothing
    if (stats.totalEvents === 0 && executions.length === 0 && aggregateStats && aggregateStats.totalExecutions > 0) {
      stats = {
        totalEvents: aggregateStats.totalExecutions,
        successEvents: Math.max(0, aggregateStats.totalExecutions - aggregateStats.totalErrors),
        successRate: aggregateStats.totalExecutions > 0
          ? Math.round(((aggregateStats.totalExecutions - aggregateStats.totalErrors) / aggregateStats.totalExecutions) * 100)
          : 0,
        avgDuration: 0,
        totalCost: 0,
      };
    }
    return [
      { label: 'Executions', value: String(stats.totalEvents), sublabel: 'All time', icon: BarChart3, accent: '', sparkData, sparkColor: 'blue' },
      {
        label: 'Success Rate',
        value: `${stats.successRate}%`,
        icon: stats.successRate === 0 && stats.totalEvents > 0 ? XCircle : stats.successRate < 80 ? AlertTriangle : CheckCircle2,
        accent: stats.totalEvents === 0 ? '' : stats.successRate === 0 ? 'red' : stats.successRate < 80 ? 'amber' : 'green',
      },
      {
        label: 'Errors',
        value: String(stats.totalEvents - stats.successEvents),
        icon: AlertTriangle,
        accent: (stats.totalEvents - stats.successEvents) > 0 ? 'red' : '',
      },
      {
        label: 'Operations',
        value: String(aggregateStats?.totalOperations ?? data?.details?.make_total_operations ?? 0),
        icon: Zap,
        accent: '',
      },
    ];
  }, [data?.stats, data?.details, sparkData, executions, aggregateStats]);

  const integrations = Array.isArray(data?.details?.used_packages) ? data?.details?.used_packages as string[] : [];
  const hasMore = limit < 20 && executions.length >= limit;

  // Determine if we should show "aggregate only" message instead of empty
  const hasAggregateOnly = executions.length === 0 && aggregateStats && aggregateStats.totalExecutions > 0;

  return (
    <div className="space-y-5">
      <HealthBanner health={health} platformLabel="Make" />
      <MetricsBar kpis={kpis} />
      <IntegrationPills packages={integrations} />

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Execution History (Last 30 Days)</h3>
          <div className="flex items-center gap-2">
            <ExportButton sourceId={sourceId} externalId={externalId} platform="make" mode="scenario-structure" />
            <span className="text-xs text-gray-400">{executions.length} in window</span>
          </div>
        </div>
        {loading ? <div className="flex items-center gap-2 py-3 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Loading executions...</div> : null}
        {!loading && executions.length === 0 && !hasAggregateOnly ? <div className="py-4 text-sm text-gray-400">No executions recorded yet.</div> : null}
        {!loading && hasAggregateOnly ? (
          <div className="py-4 text-sm text-gray-500">
            <span className="font-medium">{aggregateStats!.totalExecutions} executions</span> recorded on Make.
            <span className="ml-1 text-gray-400">Individual execution details are not available from the Make API for this scenario type.</span>
          </div>
        ) : null}
        <div className="space-y-1">{executions.map((e) => <ExecutionRow key={e.id} execution={e} platform="make" />)}</div>
        {hasMore ? <button type="button" onClick={() => { setLoading(true); setLimit(20); }} className="mt-3 cursor-pointer rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50">Load More</button> : null}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <button type="button" onClick={() => setConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors duration-200 hover:text-gray-600">
          {configOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Scenario Configuration
        </button>
        <AnimatePresence initial={false}>
          {configOpen ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-2 pt-2 text-sm text-gray-600">
                <div><span className="text-xs text-gray-400">Status</span> {(data?.details?.is_active ? 'Active' : data?.details?.is_paused ? 'Paused' : 'Inactive') as string}</div>
                <div><span className="text-xs text-gray-400">Schedule</span> {String(data?.details?.scheduling_type ?? '—')}</div>
                <div><span className="text-xs text-gray-400">Modules</span> {String(data?.details?.module_count ?? 0)}</div>
                <div><span className="text-xs text-gray-400">Created By</span> {String(data?.details?.created_by ?? '—')}</div>
                <div><span className="text-xs text-gray-400">Last Edit</span> {String(data?.details?.last_edit ?? '—')}</div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
