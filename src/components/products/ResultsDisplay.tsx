"use client";

// ============================================================================
// Level 4: ResultsDisplay — Premium Results Viewer
// Features: realtime polling, animated checkmark, result cards, action bar
// ============================================================================

import { useState, useEffect, useCallback } from "react";

interface ResultsDisplayProps {
  executionId: string;
  initialStatus: string;
  initialResults: Record<string, unknown> | null;
  initialError: string | null;
  initialDuration: number | null;
  productName: string;
  productSlug: string;
  designTokens: Record<string, any>;
}

export function ResultsDisplay({
  executionId,
  initialStatus,
  initialResults,
  initialError,
  initialDuration,
  productName,
  productSlug,
  designTokens,
}: ResultsDisplayProps) {
  const [status, setStatus] = useState(initialStatus);
  const [results, setResults] = useState<Record<string, unknown> | null>(initialResults);
  const [error, setError] = useState<string | null>(initialError);
  const [duration, setDuration] = useState<number | null>(initialDuration);
  const [showCheckmark, setShowCheckmark] = useState(false);

  const colors = designTokens?.colors ?? {};
  const primary = colors.primary ?? "#6366f1";
  const background = colors.background ?? "#ffffff";
  const text = colors.text ?? "#111827";
  const surface = colors.surface ?? "#f9fafb";
  const success = colors.success ?? "#10b981";

  // ── Poll for results ──────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/executions/${executionId}`);
      const data = await res.json();
      if (data.ok && data.execution) {
        setStatus(data.execution.status);
        if (data.execution.mapped_results) setResults(data.execution.mapped_results);
        if (data.execution.error_message) setError(data.execution.error_message);
        if (data.execution.duration_ms) setDuration(data.execution.duration_ms);
        return data.execution.status;
      }
    } catch {
      // Ignore poll errors
    }
    return status;
  }, [executionId, status]);

  useEffect(() => {
    if (status === "success" || status === "error" || status === "timeout") {
      if (status === "success") {
        setTimeout(() => setShowCheckmark(true), 100);
      }
      return;
    }

    const interval = setInterval(async () => {
      const newStatus = await poll();
      if (newStatus === "success" || newStatus === "error" || newStatus === "timeout") {
        clearInterval(interval);
        if (newStatus === "success") {
          setTimeout(() => setShowCheckmark(true), 100);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [status, poll]);

  // ── Loading state ─────────────────────────────────────────────────────
  if (status === "pending" || status === "running") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ backgroundColor: background, color: text }}
      >
        <div className="relative w-20 h-20">
          <div
            className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `${primary}33`, borderTopColor: primary }}
          />
          <div
            className="absolute inset-2 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `${primary}22`, borderTopColor: `${primary}88`, animationDirection: "reverse", animationDuration: "1.5s" }}
          />
        </div>
        <h2 className="text-xl font-semibold">Processing your request...</h2>
        <p className="text-sm opacity-50">This usually takes a few seconds</p>
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: primary, animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (status === "error" || status === "timeout") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
        style={{ backgroundColor: background, color: text }}
      >
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">
          {status === "timeout" ? "Request Timed Out" : "Something Went Wrong"}
        </h2>
        <p className="text-sm opacity-60 max-w-md text-center">
          {error ?? "An unexpected error occurred. Please try again."}
        </p>
        <a
          href={`/products/${productSlug}/run`}
          className="mt-4 px-6 py-3 rounded-lg text-white font-medium transition-all hover:scale-[1.02]"
          style={{ backgroundColor: primary }}
        >
          Try Again
        </a>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────
  const resultEntries = results ? Object.entries(results).filter(([k]) => !k.startsWith("_")) : [];

  // Find "primary" result (first entry, or one named score/result/total)
  const primaryKeys = ["score", "result", "total", "headline", "title", "summary"];
  const primaryEntry = resultEntries.find(([k]) => primaryKeys.includes(k.toLowerCase())) ?? resultEntries[0];
  const secondaryEntries = resultEntries.filter((e) => e !== primaryEntry);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: background, color: text }}>
      {/* Success banner */}
      <div className="py-12 text-center" style={{ backgroundColor: `${success}10` }}>
        {/* Animated checkmark */}
        <div className="mx-auto mb-4 relative w-20 h-20">
          <svg
            className={`w-20 h-20 transition-all duration-700 ${showCheckmark ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
            viewBox="0 0 52 52"
          >
            <circle
              cx="26" cy="26" r="25"
              fill="none"
              stroke={success}
              strokeWidth="2"
              className={showCheckmark ? "animate-[circle_0.6s_ease-in-out_forwards]" : ""}
              strokeDasharray="166"
              strokeDashoffset={showCheckmark ? "0" : "166"}
              style={{ transition: "stroke-dashoffset 0.6s ease-in-out" }}
            />
            <path
              fill="none"
              stroke={success}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27l8 8 16-16"
              strokeDasharray="48"
              strokeDashoffset={showCheckmark ? "0" : "48"}
              style={{ transition: "stroke-dashoffset 0.4s ease-in-out 0.4s" }}
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: success }}>Results Ready</h1>
        {duration && (
          <p className="text-sm opacity-60 mt-1">Completed in {(duration / 1000).toFixed(1)}s</p>
        )}
      </div>

      {/* Results */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {/* Primary result */}
        {primaryEntry && (
          <div
            className="rounded-2xl p-8 mb-8 text-center"
            style={{ backgroundColor: surface }}
          >
            <p className="text-sm font-medium opacity-60 uppercase tracking-wider mb-2">
              {formatKey(primaryEntry[0])}
            </p>
            <p className="text-4xl font-bold" style={{ color: primary }}>
              {formatValue(primaryEntry[1])}
            </p>
          </div>
        )}

        {/* Secondary results grid */}
        {secondaryEntries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {secondaryEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl p-6"
                style={{ backgroundColor: surface }}
              >
                <p className="text-xs font-medium opacity-50 uppercase tracking-wider mb-2">
                  {formatKey(key)}
                </p>
                <p className="text-lg font-semibold leading-relaxed">
                  {formatValue(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {resultEntries.length === 0 && (
          <div className="text-center py-12 opacity-50">
            <p>Workflow completed successfully but returned no displayable results.</p>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-8 border-t" style={{ borderColor: `${text}10` }}>
          <a
            href={`/products/${productSlug}/run`}
            className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: primary }}
          >
            Run Again
          </a>
          <button
            onClick={() => {
              const text = resultEntries.map(([k, v]) => `${formatKey(k)}: ${formatValue(v)}`).join("\n");
              navigator.clipboard?.writeText(text);
            }}
            className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: surface }}
          >
            Copy Results
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: productName, url: window.location.href });
              } else {
                navigator.clipboard?.writeText(window.location.href);
              }
            }}
            className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: surface }}
          >
            Share
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs opacity-30">
        Powered by AI
      </footer>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
