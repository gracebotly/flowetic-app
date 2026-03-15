'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, Power, XCircle } from 'lucide-react';
import { HealthBanner, type EntityHealth } from './shared/HealthBanner';
import { MetricsBar, type MetricKPI } from './shared/MetricsBar';
import { deriveEntityHealth } from './shared/deriveEntityHealth';
import { ExecutionRow, type ExecutionData } from './shared/ExecutionRow';
import { ExportButton } from './shared/ExportButton';

interface N8nDetailPanelProps {
  sourceId: string;
  externalId: string;
  onHealthChange?: (health: EntityHealth) => void;
}

interface N8nData {
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

function formatDuration(ms: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function N8nDetailPanel({ sourceId, externalId, onHealthChange }: N8nDetailPanelProps) {
  const [data, setData] = useState<N8nData | null>(null);
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(5);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`/api/connections/entity-details?source_id=${sourceId}&external_id=${externalId}&platform=n8n`).then((r) => r.json()),
      fetch(`/api/connections/entity-executions/n8n?source_id=${sourceId}&workflow_id=${externalId}&limit=${limit}`).then((r) => r.json()),
    ]).then(([d, e]) => {
      if (!mounted) return;
      setData(d);
      setExecutions(Array.isArray(e?.executions) ? e.executions : []);
    }).catch(() => {
      if (!mounted) return;
      setData({ ok: false, details: null, stats: { totalEvents: 0, successEvents: 0, successRate: 0, avgDuration: 0, totalCost: 0 }, error: 'Unknown error' });
      setExecutions([]);
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [sourceId, externalId, limit]);

  const health = useMemo(() => {
    const stats = data?.stats ?? null;
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
    const h = deriveEntityHealth(stats, data?.error ?? null);
    return h.status === 'no-data' ? { ...h, entityKind: 'workflow' } : h;
  }, [data?.stats, data?.error, executions]);

  useEffect(() => { if (data) onHealthChange?.(health); }, [data, health, onHealthChange]);

  const sparkData = useMemo(() => computeSparkData(executions), [executions]);

  const kpis: MetricKPI[] = useMemo(() => {
    let stats = data?.stats ?? { totalEvents: 0, successEvents: 0, successRate: 0, avgDuration: 0, totalCost: 0 };
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
    return [
      { label: 'Executions', value: String(stats.totalEvents), sublabel: 'All time', icon: BarChart3, accent: '', sparkData, sparkColor: 'blue' },
      {
        label: 'Success Rate',
        value: `${stats.successRate}%`,
        icon: stats.successRate === 0 && stats.totalEvents > 0 ? XCircle : stats.successRate < 80 ? AlertTriangle : CheckCircle2,
        accent: stats.totalEvents === 0 ? '' : stats.successRate === 0 ? 'red' : stats.successRate < 80 ? 'amber' : 'green',
      },
      { label: 'Avg Duration', value: formatDuration(stats.avgDuration), icon: Clock, accent: '' },
      {
        label: 'Status',
        value: data?.details?.active ? 'Active' : 'Inactive',
        icon: Power,
        accent: data?.details?.active ? 'green' : 'amber',
      },
    ];
  }, [data?.stats, data?.details, sparkData, executions]);

  const tags = Array.isArray(data?.details?.tags) ? data?.details?.tags as string[] : [];
  const nodeTypes = Array.isArray(data?.details?.node_types) ? data?.details?.node_types as string[] : [];
  const hasMore = limit < 20 && executions.length >= limit;

  return (
    <div className="space-y-5">
      <HealthBanner health={health} platformLabel="n8n" />
      <MetricsBar kpis={kpis} />

      {tags.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => <span key={tag} className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">{tag}</span>)}
          </div>
        </div>
      ) : null}

      {nodeTypes.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Node Types</div>
          <div className="flex flex-wrap gap-1.5">
            {nodeTypes.map((nt) => <span key={nt} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{nt}</span>)}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Execution History (Last 30 Days)</h3>
          <div className="flex items-center gap-2">
            <ExportButton sourceId={sourceId} externalId={externalId} platform="n8n" mode="workflow-structure" />
            <span className="text-xs text-gray-400">{executions.length} in window</span>
          </div>
        </div>
        {loading ? <div className="flex items-center gap-2 py-3 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Loading executions...</div> : null}
        {!loading && executions.length === 0 ? <div className="py-4 text-sm text-gray-400">No executions recorded yet.</div> : null}
        <div className="space-y-1">{executions.map((e) => <ExecutionRow key={e.id} execution={e} platform="n8n" />)}</div>
        {hasMore ? <button type="button" onClick={() => { setLoading(true); setLimit(20); }} className="mt-3 cursor-pointer rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50">Load More</button> : null}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <button type="button" onClick={() => setConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors duration-200 hover:text-gray-600">
          {configOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Workflow Configuration
        </button>
        <AnimatePresence initial={false}>
          {configOpen ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-2 pt-2 text-sm text-gray-600">
                <div><span className="text-xs text-gray-400">Active:</span> {data?.details?.active ? 'Yes' : 'No'}</div>
                <div><span className="text-xs text-gray-400">Node Count:</span> {String(data?.details?.node_count ?? 0)}</div>
                <div><span className="text-xs text-gray-400">Updated:</span> {String(data?.details?.updated_at ?? '—')}</div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
