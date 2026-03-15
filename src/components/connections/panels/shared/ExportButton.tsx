'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  sourceId: string;
  externalId: string;
  platform: string;
  mode: 'transcripts' | 'executions' | 'workflow-structure' | 'scenario-structure';
  entityName?: string;
}

const LABELS: Record<ExportButtonProps['mode'], { button: string; filename: string; type: string }> = {
  transcripts: { button: 'Export Transcripts', filename: 'transcripts', type: 'calls' },
  executions: { button: 'Export Executions', filename: 'executions', type: 'executions' },
  'workflow-structure': { button: 'Export Workflow Structure', filename: 'workflow_structure', type: 'executions' },
  'scenario-structure': { button: 'Export Scenario Structure', filename: 'scenario_structure', type: 'executions' },
};

export function ExportButton({ sourceId, externalId, platform, mode, entityName }: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = LABELS[mode];

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const exportMode = mode === 'transcripts' ? 'full'
        : mode === 'executions' ? 'full'
          : 'nodes';

      const params = new URLSearchParams({
        source_id: sourceId,
        external_id: externalId,
        platform,
        type: config.type,
        redact_pii: 'false',
        export_mode: exportMode,
      });

      const res = await fetch(`/api/connections/entity-export?${params.toString()}`);

      if (!res.ok) {
        let code = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          code = body?.code ?? body?.error ?? code;
        } catch {
          // non-JSON error body
        }
        setError(`Export failed: ${code}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (entityName ?? platform).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      a.download = `${safeName}_${config.filename}_${new Date().toISOString().slice(0, 10)}.csv`;
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

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={downloading}
        onClick={download}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {config.button}
      </button>
      {error && (
        <p className="max-w-[220px] text-right text-[11px] text-red-500">{error}</p>
      )}
    </div>
  );
}
