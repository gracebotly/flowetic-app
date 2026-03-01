'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, Download, AlertTriangle, Clock } from 'lucide-react';
import {
  ProductThemeProvider,
  ThemeToggle,
  useTheme,
} from '@/lib/products/ThemeProvider';
import {
  selectResultTemplate,
  formatOutputValue,
} from '@/lib/products/selectResultTemplate';

interface ResultsDisplayProps {
  executionId: string;
  initialStatus: string;
  initialResults: Record<string, unknown> | null;
  initialError: string | null;
  initialDuration: number | null;
  productName: string;
  productSlug: string;
  designTokens: Record<string, unknown> | null;
}

export function ResultsDisplay(props: ResultsDisplayProps) {
  return (
    <ProductThemeProvider designTokens={props.designTokens}>
      <ResultsContent {...props} />
    </ProductThemeProvider>
  );
}

function ResultsContent({
  executionId,
  initialStatus,
  initialResults,
  initialError,
  initialDuration,
  productName,
  productSlug,
}: ResultsDisplayProps) {
  const { colors } = useTheme();
  const [status, setStatus] = useState(initialStatus);
  const [results, setResults] = useState(initialResults);
  const [error, setError] = useState(initialError);
  const [duration, setDuration] = useState(initialDuration);
  const [showCheck, setShowCheck] = useState(false);
  const [copied, setCopied] = useState(false);

  // Poll for pending/running executions
  useEffect(() => {
    if (status === 'success' || status === 'error' || status === 'timeout') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/products/executions/${executionId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (
          data.status === 'success' ||
          data.status === 'error' ||
          data.status === 'timeout'
        ) {
          setStatus(data.status);
          setResults(data.mapped_results ?? data.outputs ?? null);
          setError(data.error_message ?? null);
          setDuration(data.duration_ms ?? null);
          clearInterval(interval);
        }
      } catch {
        /* ignore polling errors */
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, executionId]);

  // Delayed checkmark animation trigger
  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => setShowCheck(true), 300);
      return () => clearTimeout(t);
    }
  }, [status]);

  // ── Loading ───────────────────────────────────────────────────────────
  if (status === 'pending' || status === 'running') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <div className="relative h-16 w-16">
          <div
            className="absolute inset-0 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary }}
          />
        </div>
        <p className="animate-pulse text-lg font-medium">Running your workflow...</p>
        <p className="text-sm" style={{ color: colors.textMuted }}>
          This usually takes a few seconds
        </p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (status === 'error' || status === 'timeout') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <header className="fixed top-0 right-0 p-4">
          <ThemeToggle />
        </header>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.error}15` }}
        >
          {status === 'timeout' ? (
            <Clock className="h-10 w-10" style={{ color: colors.error }} />
          ) : (
            <AlertTriangle className="h-10 w-10" style={{ color: colors.error }} />
          )}
        </motion.div>
        <h2 className="text-2xl font-bold">
          {status === 'timeout' ? 'Request Timed Out' : 'Something Went Wrong'}
        </h2>
        <p className="max-w-md text-center text-sm" style={{ color: colors.textMuted }}>
          {error ?? 'An unexpected error occurred. Please try again.'}
        </p>
        <a
          href={`/products/${productSlug}/run`}
          className="mt-4 rounded-xl px-6 py-3 font-medium text-white transition-all hover:scale-[1.02]"
          style={{ backgroundColor: colors.primary }}
        >
          Try Again
        </a>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────
  const safeResults = results ?? {};
  const resultEntries = Object.entries(safeResults).filter(([k]) => !k.startsWith('_'));

  const template = selectResultTemplate(safeResults);

  function handleCopy() {
    const text = resultEntries
      .map(([k, v]) => {
        const f = formatOutputValue(k, v);
        return `${f.label}: ${f.display}`;
      })
      .join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: productName, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="relative">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <span className="text-sm font-medium" style={{ color: colors.textMuted }}>
          {productName}
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={showCheck ? { scale: 1 } : {}}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.success}15` }}
        >
          <svg viewBox="0 0 52 52" className="h-12 w-12">
            <circle
              cx="26"
              cy="26"
              r="24"
              fill="none"
              stroke={colors.success}
              strokeWidth="2"
              strokeDasharray="150"
              strokeDashoffset={showCheck ? '0' : '150'}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <path
              fill="none"
              stroke={colors.success}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27l8 8 16-16"
              strokeDasharray="48"
              strokeDashoffset={showCheck ? '0' : '48'}
              style={{ transition: 'stroke-dashoffset 0.4s ease 0.3s' }}
            />
          </svg>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-2 text-center"
        >
          <h2 className="text-2xl font-bold">Workflow Complete</h2>
          {duration != null && (
            <p className="mt-1 text-sm" style={{ color: colors.textMuted }}>
              Finished in {(duration / 1000).toFixed(1)}s
            </p>
          )}
        </motion.div>

        {/* Results — template-driven rendering */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8"
        >
          {/* success-message */}
          {template === 'success-message' && (
            <div
              className="rounded-2xl p-6 text-center"
              style={{
                backgroundColor: `${colors.success}10`,
                border: `1px solid ${colors.success}25`,
              }}
            >
              <p className="text-lg font-medium" style={{ color: colors.success }}>
                {resultEntries.length > 0
                  ? String(resultEntries[0][1])
                  : 'Workflow executed successfully.'}
              </p>
            </div>
          )}

          {/* score-card */}
          {template === 'score-card' && (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
            >
              {resultEntries.map(([key, value]) => {
                const formatted = formatOutputValue(key, value);
                const isScore =
                  formatted.type === 'number' &&
                  /score|rating|confidence|grade|percent|pct/i.test(key);

                if (isScore) {
                  return (
                    <div key={key} className="mb-6">
                      <p className="mb-2 text-sm" style={{ color: colors.textMuted }}>
                        {formatted.label}
                      </p>
                      <p
                        className="text-6xl font-extrabold tabular-nums"
                        style={{ color: colors.primary }}
                      >
                        {formatted.display}
                      </p>
                    </div>
                  );
                }
                return (
                  <div
                    key={key}
                    className="mt-4 pt-4 text-left"
                    style={{ borderTop: `1px solid ${colors.border}` }}
                  >
                    <p className="text-xs" style={{ color: colors.textMuted }}>
                      {formatted.label}
                    </p>
                    <p className="mt-0.5 text-sm">{formatted.display}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* data-card */}
          {template === 'data-card' && (
            <div
              className="overflow-hidden rounded-2xl"
              style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
            >
              {resultEntries.map(([key, value], i) => {
                const formatted = formatOutputValue(key, value);
                return (
                  <div
                    key={key}
                    className="flex justify-between gap-4 px-5 py-3.5"
                    style={{
                      borderBottom:
                        i < resultEntries.length - 1
                          ? `1px solid ${colors.border}`
                          : 'none',
                    }}
                  >
                    <span
                      className="flex-shrink-0 text-sm"
                      style={{ color: colors.textMuted }}
                    >
                      {formatted.label}
                    </span>
                    <span className="text-right text-sm font-medium">
                      {formatted.type === 'url' ? (
                        <a
                          href={formatted.display}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline transition-colors"
                          style={{ color: colors.primary }}
                        >
                          {formatted.display.length > 40
                            ? formatted.display.slice(0, 40) + '...'
                            : formatted.display}
                        </a>
                      ) : (
                        formatted.display
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* table-result */}
          {template === 'table-result' &&
            (() => {
              const tableEntry = resultEntries.find(
                ([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object',
              );
              if (!tableEntry) return null;
              const rows = tableEntry[1] as Record<string, unknown>[];
              const columns = Object.keys(rows[0]);

              return (
                <div
                  className="overflow-x-auto rounded-2xl"
                  style={{ border: `1px solid ${colors.border}` }}
                >
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: colors.surface }}>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                            style={{ color: colors.textMuted }}
                          >
                            {col.replace(/[_-]/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 25).map((row, i) => (
                        <tr
                          key={i}
                          className="transition-colors"
                          style={{
                            borderBottom: `1px solid ${colors.border}`,
                            backgroundColor: 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.surfaceHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {columns.map((col) => (
                            <td key={col} className="px-4 py-2.5">
                              {String(row[col] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 25 && (
                    <p className="py-3 text-center text-xs" style={{ color: colors.textMuted }}>
                      Showing 25 of {rows.length} results
                    </p>
                  )}
                </div>
              );
            })()}

          {/* download-result */}
          {template === 'download-result' &&
            (() => {
              const urlEntry = resultEntries.find(
                ([k, v]) =>
                  typeof v === 'string' &&
                  (v.startsWith('http://') || v.startsWith('https://')) &&
                  /url|link|download|file|attachment|report|export/i.test(k),
              );

              return (
                <div
                  className="rounded-2xl p-6 text-center"
                  style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
                >
                  {/* Non-URL entries as context */}
                  {resultEntries
                    .filter(([k]) => k !== urlEntry?.[0])
                    .map(([key, value]) => {
                      const formatted = formatOutputValue(key, value);
                      return (
                        <div key={key} className="mb-3 text-left">
                          <p className="text-xs" style={{ color: colors.textMuted }}>
                            {formatted.label}
                          </p>
                          <p className="text-sm">{formatted.display}</p>
                        </div>
                      );
                    })}

                  {urlEntry && (
                    <a
                      href={String(urlEntry[1])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white transition-all hover:scale-[1.02]"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Download className="h-4 w-4" />
                      Download Result
                    </a>
                  )}
                </div>
              );
            })()}

          {/* Empty results guard */}
          {resultEntries.length === 0 && template === 'success-message' && (
            <div className="py-12 text-center" style={{ color: colors.textMuted, opacity: 0.6 }}>
              <p>Workflow completed successfully but returned no displayable results.</p>
            </div>
          )}
        </motion.div>

        {/* Action bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t pt-8"
          style={{ borderColor: colors.border }}
        >
          <a
            href={`/products/${productSlug}/run`}
            className="rounded-xl px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: colors.primary }}
          >
            Run Again
          </a>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer
        className="py-6 text-center text-xs"
        style={{ color: colors.textMuted, opacity: 0.4 }}
      >
        Powered by AI
      </footer>
    </div>
  );
}
