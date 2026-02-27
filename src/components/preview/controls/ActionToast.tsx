"use client";

import React, { useState, useCallback, useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  success: boolean;
}

interface ActionToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ActionToastContainer({ toasts, onDismiss }: ActionToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right-5 duration-200"
          style={{
            backgroundColor: "var(--gf-surface, #ffffff)",
            border: `1px solid ${toast.success ? "#22c55e" : "#ef4444"}`,
            color: "var(--gf-text, #111827)",
          }}
        >
          {toast.success ? (
            <CheckCircle size={14} className="text-green-500 shrink-0" />
          ) : (
            <XCircle size={14} className="text-red-500 shrink-0" />
          )}
          <span className="truncate max-w-xs">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-1 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useActionToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, success: boolean) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, success }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => dismiss(latest.id), 3000);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  return { toasts, showToast, dismiss };
}
