"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteWorkspaceModalProps {
  onClose: () => void;
  onDeleted: () => void;
}

const CONFIRMATION_TEXT = "DELETE MY WORKSPACE";

export function DeleteWorkspaceModal({
  onClose,
  onDeleted,
}: DeleteWorkspaceModalProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmInput === CONFIRMATION_TEXT;

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/danger", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRMATION_TEXT }),
      });
      const json = await res.json();

      if (json.ok) {
        onDeleted();
      } else {
        const messages: Record<string, string> = {
          CONFIRMATION_REQUIRED: "Please type the confirmation text exactly.",
          CLEANUP_FAILED: "Failed to delete some data. Please try again.",
          TENANT_DELETE_FAILED: "Failed to delete workspace. Please try again.",
        };
        setError(messages[json.code] || json.code || "Delete failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    }

    setDeleting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Delete Workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              This action is permanent and cannot be undone.
            </p>
            <p className="mt-1 text-sm text-red-700">
              All offerings, clients, connections, team members, and activity
              data will be permanently removed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Type{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-red-600">
                {CONFIRMATION_TEXT}
              </code>{" "}
              to confirm:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRMATION_TEXT}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-300 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete Workspace"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
