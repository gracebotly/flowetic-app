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

export function ExportButton({ sourceId, externalId, platform, type }: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function download(redactPII: boolean) {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        source_id: sourceId,
        external_id: externalId,
        platform,
        type,
        redact_pii: redactPII ? 'true' : 'false',
      });

      const res = await fetch(`/api/connections/entity-export?${params.toString()}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${platform}_${type}_export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={downloading}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors duration-200 hover:bg-gray-50"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="rounded-lg border border-gray-200 bg-white p-1 shadow-lg" sideOffset={6}>
          <DropdownMenu.Item
            onClick={() => download(false)}
            className="cursor-pointer rounded-md px-3 py-2 text-xs text-gray-700 transition-colors duration-200 hover:bg-gray-50"
          >
            Export CSV
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onClick={() => download(true)}
            className="cursor-pointer rounded-md px-3 py-2 text-xs text-gray-700 transition-colors duration-200 hover:bg-gray-50"
          >
            Export CSV (PII Redacted)
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
