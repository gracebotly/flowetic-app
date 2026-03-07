'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Mic,
  Brain,
  Globe,
  Clock,
  Zap,
  DollarSign,
  CheckCircle2,
  XCircle,
  Webhook,
  Cpu,
  Tag,
  Calendar,
  Settings,
  User,
  Layers,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { MetricsBar, type MetricKPI } from './panels/shared/MetricsBar';
import { HealthBanner, type EntityHealth } from './panels/shared/HealthBanner';
import { deriveEntityHealth } from './panels/shared/deriveEntityHealth';
import { RetellDetailPanel } from './panels/RetellDetailPanel';
import { VapiDetailPanel } from './panels/VapiDetailPanel';

interface EntityDetailsPanelProps {
  platform: string;
  sourceId: string;
  externalId: string;
  onHealthChange?: (health: EntityHealth) => void;
}

interface DetailData {
  ok: boolean;
  platform: string;
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

const FALLBACK_STATS: DetailData['stats'] = {
  totalEvents: 0,
  successEvents: 0,
  successRate: 0,
  avgDuration: 0,
  totalCost: 0,
  latestError: null,
};

function formatDuration(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatCost(v: number): string {
  if (v === 0) return '—';
  return `$${v.toFixed(2)}`;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'number') {
    return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const d = new Date(String(ts));
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | undefined | null;
  mono?: boolean;
}) {
  const display = value === undefined || value === null || value === '' ? '—' : String(value);
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-400">{label}</div>
        <div className={`mt-0.5 text-sm font-medium text-gray-900 ${mono ? 'font-mono text-xs break-all' : ''}`}>
          {display}
        </div>
      </div>
    </div>
  );
}

function toEntityKind(platform: string) {
  if (platform === 'retell' || platform === 'vapi') return 'agent';
  if (platform === 'make') return 'scenario';
  return 'workflow';
}

function StatsBar({ stats }: { stats: DetailData['stats'] }) {
  const failedCount = stats.totalEvents - stats.successEvents;
  const hasErrors = stats.totalEvents > 0 && failedCount > 0;

  const kpis: MetricKPI[] = [
    {
      label: 'Executions',
      value: stats.totalEvents.toLocaleString(),
      icon: BarChart3,
      accent: '',
    },
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: stats.successRate === 0 && stats.totalEvents > 0 ? XCircle
        : stats.successRate < 80 ? AlertTriangle
        : CheckCircle2,
      accent: stats.totalEvents === 0 ? ''
        : stats.successRate === 0 ? 'red'
        : stats.successRate < 80 ? 'amber'
        : 'green',
    },
    {
      label: hasErrors ? 'Failures' : 'Avg Duration',
      value: hasErrors ? failedCount.toLocaleString() : formatDuration(stats.avgDuration),
      icon: hasErrors ? AlertTriangle : Clock,
      accent: hasErrors ? 'red' : '',
    },
    {
      label: 'Total Cost',
      value: formatCost(stats.totalCost),
      icon: DollarSign,
      accent: '',
    },
  ];

  return <MetricsBar kpis={kpis} />;
}

function RetellDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <div className="space-y-1 divide-y divide-gray-50">
      <DetailRow icon={Mic} label="Voice" value={`${details.voice_id} (${details.voice_model})`} />
      <DetailRow icon={Globe} label="Language" value={String(details.language ?? '—')} />
      <DetailRow icon={Brain} label="Analysis Model" value={String(details.post_call_analysis_model ?? '—')} />
      <DetailRow
        icon={Zap}
        label="Responsiveness"
        value={details.responsiveness != null ? `${Number(details.responsiveness) * 100}%` : '—'}
      />
      <DetailRow
        icon={Settings}
        label="Interruption Sensitivity"
        value={details.interruption_sensitivity != null ? `${Number(details.interruption_sensitivity) * 100}%` : '—'}
      />
      <DetailRow
        icon={Clock}
        label="Max Call Duration"
        value={details.max_call_duration_ms ? `${Math.round(Number(details.max_call_duration_ms) / 60000)} min` : '—'}
      />
      <DetailRow icon={Webhook} label="Webhook URL" value={String(details.webhook_url ?? '—')} mono />
      <DetailRow icon={Cpu} label="LLM ID" value={String(details.llm_id ?? '—')} mono />
      <DetailRow icon={Calendar} label="Last Modified" value={formatTimestamp(details.last_modification_timestamp)} />
    </div>
  );
}

function VapiDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <div className="space-y-1 divide-y divide-gray-50">
      <DetailRow icon={Brain} label="LLM" value={`${details.llm_provider} / ${details.llm_model}`} />
      <DetailRow icon={Mic} label="Voice" value={`${details.voice_provider} / ${details.voice_id}`} />
      <DetailRow icon={Settings} label="Voice Model" value={String(details.voice_model ?? '—')} />
      <DetailRow icon={Cpu} label="Transcriber" value={`${details.transcriber_provider} / ${details.transcriber_model}`} />
      <DetailRow icon={Layers} label="Tools Attached" value={`${details.tool_count ?? 0} tools`} />
      {details.firstMessage ? (
        <div className="py-2.5">
          <div className="text-xs text-gray-400">First Message</div>
          <div className="mt-1 rounded-md bg-gray-50 p-2 text-sm text-gray-700 italic">&ldquo;{String(details.firstMessage)}&rdquo;</div>
        </div>
      ) : null}
      <DetailRow icon={Calendar} label="Created" value={formatTimestamp(details.created_at)} />
      <DetailRow icon={Calendar} label="Updated" value={formatTimestamp(details.updated_at)} />
    </div>
  );
}

function MakeDetails({ details }: { details: Record<string, unknown> }) {
  const modules = Array.isArray(details.modules_used) ? details.modules_used : [];
  const packages = Array.isArray(details.used_packages) ? details.used_packages : [];
  const latestError = details.latest_error ? String(details.latest_error) : null;
  const makeErrors = typeof details.make_total_errors === 'number' ? details.make_total_errors : 0;
  const makeOps = typeof details.make_total_operations === 'number' ? details.make_total_operations : 0;

  return (
    <div className="space-y-1 divide-y divide-gray-50">
      {latestError ? (
        <div className="!border-b-0 mb-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-800">Recent execution failure</div>
              <div className="mt-0.5 text-xs text-red-700 break-words">{latestError.length > 200 ? latestError.slice(0, 200) + '…' : latestError}</div>
            </div>
          </div>
        </div>
      ) : null}
      {details.description ? <DetailRow icon={Tag} label="Description" value={String(details.description)} /> : null}
      <DetailRow icon={Zap} label="Status" value={details.is_active ? 'Active' : details.is_paused ? 'Paused' : 'Inactive'} />
      <DetailRow
        icon={Clock}
        label="Schedule"
        value={
          details.scheduling_type === 'indefinitely'
            ? `Every ${Math.round(Number(details.scheduling_interval ?? 900) / 60)} min`
            : String(details.scheduling_type ?? '—')
        }
      />
      <DetailRow icon={Layers} label="Modules" value={`${details.module_count ?? 0} modules`} />
      {packages.length > 0 ? (
        <div className="py-2.5">
          <div className="text-xs text-gray-400">Integrations</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {packages.map((p: string) => (
              <span
                key={p}
                className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 capitalize"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {modules.length > 0 ? (
        <div className="py-2.5">
          <div className="text-xs text-gray-400">Module List</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {modules.map((m: string, i: number) => (
              <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {m.replace(/.*:/, '')}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {makeOps > 0 ? <DetailRow icon={BarChart3} label="Total Operations" value={makeOps.toLocaleString()} /> : null}
      {makeErrors > 0 ? <DetailRow icon={AlertTriangle} label="Total Errors" value={String(makeErrors)} /> : null}
      <DetailRow icon={User} label="Created By" value={String(details.created_by ?? '—')} />
      <DetailRow icon={Calendar} label="Created" value={formatTimestamp(details.created)} />
      <DetailRow icon={Calendar} label="Last Edit" value={formatTimestamp(details.last_edit)} />
    </div>
  );
}

function N8nDetails({ details }: { details: Record<string, unknown> }) {
  const nodeTypes = Array.isArray(details.node_types) ? details.node_types : [];
  const tags = Array.isArray(details.tags) ? details.tags : [];
  const latestError = details.latest_error ? String(details.latest_error) : null;

  return (
    <div className="space-y-1 divide-y divide-gray-50">
      {latestError ? (
        <div className="!border-b-0 mb-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-800">Recent execution failure</div>
              <div className="mt-0.5 text-xs text-red-700 break-words">{latestError.length > 200 ? latestError.slice(0, 200) + '…' : latestError}</div>
            </div>
          </div>
        </div>
      ) : null}
      <DetailRow icon={Zap} label="Status" value={details.active ? 'Active' : 'Inactive'} />
      <DetailRow icon={Layers} label="Nodes" value={`${details.node_count ?? 0} nodes`} />
      {tags.length > 0 ? (
        <div className="py-2.5">
          <div className="text-xs text-gray-400">Tags</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((t: string) => (
              <span key={t} className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {nodeTypes.length > 0 ? (
        <div className="py-2.5">
          <div className="text-xs text-gray-400">Node Types</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {nodeTypes.map((nt: string) => (
              <span key={nt} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {nt}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <DetailRow icon={Calendar} label="Created" value={formatTimestamp(details.created_at)} />
      <DetailRow icon={Calendar} label="Updated" value={formatTimestamp(details.updated_at)} />
    </div>
  );
}

function GenericEntityDetailsPanel({ platform, sourceId, externalId, onHealthChange }: EntityDetailsPanelProps) {
  const [data, setData] = useState<DetailData | null>(null);


  useEffect(() => {
    let mounted = true;

    fetch(`/api/connections/entity-details?source_id=${sourceId}&external_id=${externalId}&platform=${platform}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted) setData(json);
      })
      .catch(() => {
        if (mounted) setData({ ok: false, platform, details: null, stats: FALLBACK_STATS, error: 'Unknown error' });
      });

    return () => {
      mounted = false;
    };
  }, [platform, sourceId, externalId]);

  const computedHealth = useMemo(() => {
    const entityKind = toEntityKind(platform);
    const health = deriveEntityHealth(data?.stats ?? FALLBACK_STATS, data?.error ?? null);
    return health.status === 'no-data' ? { ...health, entityKind } : health;
  }, [data?.error, data?.stats, platform]);

  useEffect(() => {
    if (data) {
      onHealthChange?.(computedHealth);
    }
  }, [computedHealth, data, onHealthChange]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">Loading details...</span>
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div className="space-y-5">
        <HealthBanner
          health={computedHealth}
          platformLabel={platform}
        />
        <StatsBar stats={data?.stats ?? FALLBACK_STATS} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HealthBanner health={computedHealth} platformLabel={platform} />
      <StatsBar stats={data.stats} />

      {data.details ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {platform === 'retell'
              ? 'Agent Configuration'
              : platform === 'vapi'
                ? 'Assistant Configuration'
                : platform === 'make'
                  ? 'Scenario Configuration'
                  : 'Workflow Configuration'}
          </h3>
          {platform === 'retell' ? <RetellDetails details={data.details} /> : null}
          {platform === 'vapi' ? <VapiDetails details={data.details} /> : null}
          {platform === 'make' ? <MakeDetails details={data.details} /> : null}
          {platform === 'n8n' ? <N8nDetails details={data.details} /> : null}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6 text-center">
          <div className="text-sm text-gray-400">Could not fetch live configuration from {platform}.</div>
          <div className="mt-1 text-xs text-gray-300">
            Check that your API credentials are valid and the {platform} service is accessible.
          </div>
        </div>
      )}
    </div>
  );
}


export function EntityDetailsPanel({ platform, sourceId, externalId, onHealthChange }: EntityDetailsPanelProps) {
  if (platform === 'retell') {
    return <RetellDetailPanel platform="retell" sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
  }

  if (platform === 'vapi') {
    return <VapiDetailPanel platform="vapi" sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
  }

  return <GenericEntityDetailsPanel platform={platform} sourceId={sourceId} externalId={externalId} onHealthChange={onHealthChange} />;
}
