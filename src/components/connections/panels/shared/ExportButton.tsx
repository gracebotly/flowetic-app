'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  sourceId: string;
  externalId: string;
  platform: string;
  type: 'calls' | 'executions';
  entityName?: string;
}

export function ExportButton({ sourceId, externalId, platform, type, entityName }: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(mode: 'full' | 'redacted' | 'nodes') {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        source_id: sourceId,
        external_id: externalId,
        platform,
        type,
        redact_pii: mode === 'redacted' ? 'true' : 'false',
        export_mode: mode,
      });

      const res = await fetch(`/api/connections/entity-export?${params.toString()}`);

      if (!res.ok) {
        let code = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          code = body?.code ?? body?.error ?? code;
        } catch { /* non-JSON error body */ }
        setError(`Export failed: ${code}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (entityName ?? platform).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      a.download = `${safeName}_${mode === 'nodes' ? 'node_summary' : mode === 'redacted' ? 'data_redacted' : 'data'}_export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Export failed: ${message}`);
    } finally {
      setDownloading(false);
    }
  }

  const isWorkflow = platform === 'n8n' || platform === 'make';

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={downloading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="z-[100] min-w-[180px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg" sideOffset={6}>
            <DropdownMenu.Label className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {isWorkflow ? 'Payload Data' : 'Call Data'}
            </DropdownMenu.Label>
            <DropdownMenu.Item
              onSelect={() => download('full')}
              className="cursor-pointer rounded-md px-3 py-2 text-xs text-gray-700 transition-colors duration-200 hover:bg-gray-50"
            >
              <span className="font-medium">Export CSV</span>
              <span className="block text-[10px] text-gray-400">
                {isWorkflow ? 'Trigger payload fields' : 'Full call history + transcripts'}
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => download('redacted')}
              className="cursor-pointer rounded-md px-3 py-2 text-xs text-gray-700 transition-colors duration-200 hover:bg-gray-50"
            >
              <span className="font-medium">Export CSV (PII Redacted)</span>
              <span className="block text-[10px] text-gray-400">Emails + phone numbers masked</span>
            </DropdownMenu.Item>
            {isWorkflow && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
                <DropdownMenu.Label className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Workflow Structure
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  onSelect={() => download('nodes')}
                  className="cursor-pointer rounded-md px-3 py-2 text-xs text-gray-700 transition-colors duration-200 hover:bg-gray-50"
                >
                  <span className="font-medium">Export Node Summary</span>
                  <span className="block text-[10px] text-gray-400">Node names, types & connections</span>
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && (
        <p className="max-w-[220px] text-right text-[11px] text-red-500">{error}</p>
      )}
    </div>
  );
}
