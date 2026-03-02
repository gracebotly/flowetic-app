"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ActivityFilters } from "@/lib/activity/filterHelpers";
import { filtersToParams } from "@/lib/activity/filterHelpers";

interface ExportButtonProps {
  filters: ActivityFilters;
}

export function ExportButton({ filters }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = filtersToParams(filters);
      const res = await fetch(`/api/activity/export?${params}`);

      if (!res.ok) {
        console.error("[ExportButton] Export failed:", res.status);
        setExporting(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ExportButton] Export error:", err);
    }
    setExporting(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
    >
      {exporting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      Export CSV
    </button>
  );
}
