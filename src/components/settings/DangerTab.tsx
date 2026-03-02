"use client";

import { useState } from "react";
import { Download, Trash2, Loader2 } from "lucide-react";
import { DeleteWorkspaceModal } from "@/components/settings/DeleteWorkspaceModal";

export function DangerTab() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Export all data ───────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);

    try {
      const res = await fetch("/api/settings/danger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      });

      if (!res.ok) {
        const json = await res.json();
        setExportError(json.code || "Export failed.");
        setExporting(false);
        return;
      }

      // Trigger browser download from the JSON response
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition header if available
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? "getflowetic-export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Network error. Please try again.");
    }

    setExporting(false);
  };

  // ── After workspace deleted → sign out + redirect ─────────
  const handleDeleted = () => {
    // Workspace is gone — redirect to login
    window.location.href = "/login";
  };

  return (
    <div className="space-y-8">
      {/* Warning banner */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">
          ⚠️ This section contains irreversible actions. Please proceed with caution.
        </p>
      </div>

      {/* Export Data */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Export Data</h3>
        <p className="mt-1 text-sm text-gray-500">
          Download all your workspace data as JSON. Includes clients, offerings,
          connections, and activity events from the last 90 days.
        </p>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export All Data
            </>
          )}
        </button>

        {exportError && (
          <p className="mt-2 text-sm text-red-600">{exportError}</p>
        )}
      </div>

      {/* Delete Workspace */}
      <div className="rounded-xl border border-red-200 bg-white p-6">
        <h3 className="text-base font-semibold text-red-900">
          Delete Workspace
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Permanently delete your workspace and all associated data. This action
          cannot be undone. All offerings, clients, connections, and team members
          will be removed.
        </p>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Delete Workspace
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteWorkspaceModal
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
