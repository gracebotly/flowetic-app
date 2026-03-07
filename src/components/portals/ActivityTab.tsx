'use client';

import { Fragment, type ElementType, type ReactNode, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Phone,
  Search,
  XCircle,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { DEFAULT_ACCENT, getThemeTokens } from '@/lib/portals/themeTokens';
import {
  getEventPlatform,
  getEventStatus,
  getEventWorkflowName,
  getStateField,
  type PortalEvent,
} from '@/lib/portals/transformData';

interface ActivityTabProps {
  events: PortalEvent[];
  platformType: string;
  branding: {
    primary_color: string;
    portalName: string;
  };
}

type StatusFilter = 'all' | 'successful' | 'failed';
type RangeFilter = '7d' | '30d' | '90d' | 'all';

interface ActivityRow {
  event: PortalEvent;
  platform: string;
  name: string;
  status: string;
  durationMs: number;
  cost: number;
  timestamp: string;
}

interface SortState {
  id: keyof ActivityRow;
  desc: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function toStatusGroup(status: string): 'success' | 'error' {
  const normalized = status.toLowerCase();
  return normalized === 'success' || normalized === 'completed' ? 'success' : 'error';
}

function statusLabel(status: string) {
  return toStatusGroup(status) === 'success' ? 'Successful' : 'Failed';
}

function getDateThreshold(range: RangeFilter): number | null {
  const now = Date.now();
  if (range === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return now - 30 * 24 * 60 * 60 * 1000;
  if (range === '90d') return now - 90 * 24 * 60 * 60 * 1000;
  return null;
}

function formatTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days <= 7) return `${days}d ago`;
  return date.toLocaleString();
}

function ThemedCard({ children }: { children: ReactNode }) {
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const isDark = theme === 'dark';

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5 transition-all duration-300"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.border,
        boxShadow: `0 1px 3px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`,
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSuccess = toStatusGroup(status) === 'success';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isSuccess ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-red-400'}`} />
      {statusLabel(status)}
    </span>
  );
}

function exportCsv(rows: ActivityRow[], portalName: string) {
  const header = ['Time', 'Platform', 'Name', 'Status', 'Duration', 'Cost', 'Error'];
  const lines = rows.map((row) => {
    const error = String(getStateField(row.event, 'error_message') ?? '');
    return [
      new Date(row.timestamp).toISOString(),
      row.platform,
      row.name,
      row.status,
      formatDuration(row.durationMs),
      formatCost(row.cost),
      error,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(',');
  });

  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${portalName}-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ActivityTab({ events, platformType, branding }: ActivityTabProps) {
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const accent = branding.primary_color || DEFAULT_ACCENT;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('30d');
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<SortState>({ id: 'timestamp', desc: true });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const rows = useMemo<ActivityRow[]>(() => events.map((event) => ({
    event,
    platform: getEventPlatform(event) ?? platformType,
    name: getEventWorkflowName(event),
    status: getEventStatus(event),
    durationMs: toNumber(getStateField(event, 'duration_ms')),
    cost: toNumber(getStateField(event, 'cost')),
    timestamp: event.timestamp,
  })), [events, platformType]);

  const filteredRows = useMemo(() => {
    const threshold = getDateThreshold(rangeFilter);
    const searchValue = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter === 'successful' && toStatusGroup(row.status) !== 'success') return false;
      if (statusFilter === 'failed' && toStatusGroup(row.status) !== 'error') return false;
      if (threshold && new Date(row.timestamp).getTime() < threshold) return false;
      if (searchValue && !row.name.toLowerCase().includes(searchValue)) return false;
      return true;
    });
  }, [rangeFilter, rows, search, statusFilter]);

  const sortedRows = useMemo(() => {
    const copied = [...filteredRows];
    copied.sort((a, b) => {
      const av = a[sortState.id];
      const bv = b[sortState.id];
      if (typeof av === 'number' && typeof bv === 'number') return sortState.desc ? bv - av : av - bv;
      const at = String(av).toLowerCase();
      const bt = String(bv).toLowerCase();
      if (at === bt) return 0;
      return sortState.desc ? (at < bt ? 1 : -1) : (at > bt ? 1 : -1);
    });
    return copied;
  }, [filteredRows, sortState]);

  const columns = useMemo<ColumnDef<ActivityRow>[]>(() => [
    {
      id: 'platform', accessorKey: 'platform', header: 'Platform', size: 80,
      cell: ({ row }) => {
        const platform = row.original.platform;
        const normalized = platform.toLowerCase();
        const isVoice = normalized.includes('retell') || normalized.includes('vapi') || normalized.includes('voice');
        const Icon = isVoice ? Phone : Cpu;
        return (
          <span className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: tokens.bgExpanded, color: tokens.textSecondary }}>
            <Icon className="h-3.5 w-3.5" />
            {platform}
          </span>
        );
      },
    },
    { id: 'name', accessorKey: 'name', header: 'Name', cell: ({ getValue }) => <span style={{ color: tokens.textPrimary }}>{String(getValue())}</span> },
    { id: 'status', accessorKey: 'status', header: 'Status', size: 100, cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
    { id: 'durationMs', accessorKey: 'durationMs', header: 'Duration', size: 100, cell: ({ getValue }) => <span style={{ color: tokens.textSecondary }}>{formatDuration(Number(getValue()))}</span> },
    { id: 'cost', accessorKey: 'cost', header: 'Cost', size: 80, cell: ({ getValue }) => <span style={{ color: tokens.textSecondary }}>{formatCost(Number(getValue()))}</span> },
    { id: 'timestamp', accessorKey: 'timestamp', header: 'Time', size: 140, cell: ({ getValue }) => <span style={{ color: tokens.textSecondary }}>{formatTime(String(getValue()))}</span> },
  ], [tokens.bgExpanded, tokens.textPrimary, tokens.textSecondary]);

  const table = useReactTable({
    data: sortedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ThemedCard>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: 'all', label: 'All', icon: Clock },
              { id: 'successful', label: 'Successful', icon: CheckCircle2 },
              { id: 'failed', label: 'Failed', icon: XCircle },
            ] as Array<{ id: StatusFilter; label: string; icon: ElementType }>).map(({ id, label, icon: Icon }) => {
              const active = statusFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200"
                  style={{ backgroundColor: active ? `${accent}26` : tokens.bgExpanded, color: active ? accent : tokens.textSecondary }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => exportCsv(table.getRowModel().rows.map((row: { original: ActivityRow }) => row.original), branding.portalName)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-200"
            style={{ borderColor: tokens.border, color: tokens.textPrimary }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: '7d', label: '7d' },
            { id: '30d', label: '30d' },
            { id: '90d', label: '90d' },
            { id: 'all', label: 'All' },
          ] as Array<{ id: RangeFilter; label: string }>).map(({ id, label }) => {
            const active = rangeFilter === id;
            return (
              <button
                key={id}
                onClick={() => setRangeFilter(id)}
                className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200"
                style={{ backgroundColor: active ? `${accent}26` : tokens.bgExpanded, color: active ? accent : tokens.textSecondary }}
              >
                {label}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2 rounded-lg border px-3 py-2" style={{ backgroundColor: tokens.bgCard, borderColor: tokens.border }}>
            <Search className="h-4 w-4" style={{ color: tokens.textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-56 bg-transparent text-sm outline-none"
              style={{ color: tokens.textPrimary }}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border" style={{ borderColor: tokens.border }}>
          <table className="w-full table-fixed border-collapse">
            <thead style={{ backgroundColor: tokens.bgExpanded }}>
              {table.getHeaderGroups().map((headerGroup: { id: string; headers: Array<{ id: string; isPlaceholder: boolean; getSize: () => number; column: { id: string; columnDef: { header: unknown } }; getContext: () => unknown }> }) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ borderColor: tokens.border, color: tokens.textSecondary, width: header.getSize() }}>
                      {header.isPlaceholder ? null : (
                        <button
                          className="inline-flex cursor-pointer items-center gap-1 transition-colors duration-200 hover:opacity-80"
                          onClick={() => {
                            const id = header.column.id as keyof ActivityRow;
                            setSortState((prev) => ({ id, desc: prev.id === id ? !prev.desc : false }));
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row: { id: string; original: ActivityRow; getVisibleCells: () => Array<{ id: string; column: { id: string; columnDef: { cell: unknown } }; getContext: () => unknown }> }) => {
                const event = row.original.event;
                const isExpanded = expandedRowId === event.id;
                const isVoice = row.original.platform.toLowerCase().includes('retell') || row.original.platform.toLowerCase().includes('vapi') || row.original.platform.toLowerCase().includes('voice');

                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedRowId(isExpanded ? null : event.id)}
                      className="cursor-pointer border-b transition-colors duration-200"
                      style={{ borderColor: tokens.border, backgroundColor: tokens.bgCard }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tokens.bgExpanded; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tokens.bgCard; }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            {cell.column.id === 'name' && (isExpanded ? <ChevronDown className="h-4 w-4" style={{ color: tokens.textMuted }} /> : <ChevronRight className="h-4 w-4" style={{ color: tokens.textMuted }} />)}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t px-4 py-3"
                              style={{ backgroundColor: tokens.bgCode, borderColor: tokens.borderCode }}
                            >
                              <div className="grid gap-2 text-sm" style={{ color: tokens.textSecondary }}>
                                {isVoice ? (
                                  <>
                                    <p><span style={{ color: tokens.textPrimary }}>Summary:</span> {String(getStateField(event, 'call_summary') ?? '—')}</p>
                                    <p><span style={{ color: tokens.textPrimary }}>Transcript:</span> {String(getStateField(event, 'transcript') ?? '—').slice(0, 200)}</p>
                                    <p><span style={{ color: tokens.textPrimary }}>Sentiment:</span> {String(getStateField(event, 'sentiment') ?? '—')}</p>
                                    <p><span style={{ color: tokens.textPrimary }}>Call Successful:</span> {String(getStateField(event, 'call_successful') ?? '—')}</p>
                                  </>
                                ) : (
                                  <>
                                    <p><span style={{ color: tokens.textPrimary }}>Error Message:</span> {String(getStateField(event, 'error_message') ?? '—')}</p>
                                    <p><span style={{ color: tokens.textPrimary }}>Error Type:</span> {String(getStateField(event, 'error_name') ?? '—')}</p>
                                    <p><span style={{ color: tokens.textPrimary }}>Operations:</span> {String(getStateField(event, 'operations_used') ?? '—')}</p>
                                    <p><span style={{ color: tokens.textPrimary }}>Data Transfer:</span> {String(getStateField(event, 'data_transfer_bytes') ?? '—')}</p>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {table.getRowModel().rows.length === 0 && (
            <div className="py-10 text-center text-sm" style={{ color: tokens.textMuted }}>
              No activity found
            </div>
          )}
        </div>
      </div>
    </ThemedCard>
  );
}
