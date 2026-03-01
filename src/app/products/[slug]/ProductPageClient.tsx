'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Download } from 'lucide-react';
import { selectResultTemplate, formatOutputValue } from '@/lib/products/selectResultTemplate';

interface ProductProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    inputSchema: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
      placeholder?: string;
      options?: string[];
    }>;
    pricingType: string;
    priceCents: number | null;
    designTokens: Record<string, string> | null;
  };
  branding: {
    agencyName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
}

type ExecutionState = 'idle' | 'running' | 'success' | 'error';

interface ExecutionResult {
  outputs: Record<string, unknown>;
  durationMs: number;
  executionId: string;
}

export function ProductPageClient({ product, branding }: ProductProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    for (const field of product.inputSchema) {
      const value = formData[field.name]?.trim() || '';

      if (field.required && !value) {
        newErrors[field.name] = `${field.label} is required`;
        continue;
      }

      if (value && field.type === 'email') {
        if (!value.includes('@') || !value.includes('.')) {
          newErrors[field.name] = 'Please enter a valid email';
        }
      }

      if (value && field.type === 'number') {
        if (isNaN(Number(value))) {
          newErrors[field.name] = 'Please enter a valid number';
        }
      }

      if (value && field.type === 'url') {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          newErrors[field.name] = 'Please enter a valid URL (starting with http:// or https://)';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setExecutionState('running');
    setErrorMessage('');
    setResult(null);

    try {
      const res = await fetch('/api/products/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          inputs: formData,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setExecutionState('success');
        setResult({
          outputs: data.outputs || {},
          durationMs: data.durationMs || 0,
          executionId: data.executionId,
        });
      } else {
        setExecutionState('error');
        if (data.code === 'VALIDATION_FAILED' && data.errors) {
          setErrorMessage(data.errors.join(', '));
        } else if (data.code === 'PAYMENT_REQUIRED') {
          setErrorMessage('This product requires payment. Payment integration coming soon.');
        } else if (data.code === 'EXECUTION_TIMEOUT') {
          setErrorMessage('The workflow took too long to respond. Please try again.');
        } else {
          setErrorMessage(data.message || 'Something went wrong. Please try again.');
        }
      }
    } catch {
      setExecutionState('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  function handleReset() {
    setExecutionState('idle');
    setResult(null);
    setErrorMessage('');
  }

  function renderField(field: (typeof product.inputSchema)[0]) {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const baseClasses = `w-full rounded-lg border px-4 py-3 text-sm transition-colors outline-none ${
      error
        ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        : 'border-gray-200 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
    }`;

    const onChange = (val: string) => {
      setFormData((prev) => ({ ...prev, [field.name]: val }));
      if (errors[field.name]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field.name];
          return next;
        });
      }
    };

    return (
      <div key={field.name}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="ml-1 text-red-500">*</span>}
        </label>

        {field.type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            rows={4}
            className={baseClasses}
          />
        ) : field.type === 'select' ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClasses}>
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === 'phone' ? 'tel' : field.type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseClasses}
          />
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-xs text-red-600"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }

  function renderResults() {
    if (!result) return null;

    const template = selectResultTemplate(result.outputs);
    const entries = Object.entries(result.outputs);

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="mb-2 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-500" />
          <div>
            <p className="font-semibold text-gray-900">Workflow completed</p>
            <p className="text-xs text-gray-500">Finished in {(result.durationMs / 1000).toFixed(1)}s</p>
          </div>
        </div>

        {template === 'success-message' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              {entries.length > 0 ? String(entries[0][1]) : 'Workflow executed successfully.'}
            </p>
          </div>
        )}

        {template === 'score-card' && (
          <div className="rounded-lg border bg-white p-6 text-center">
            {entries.map(([key, value]) => {
              const formatted = formatOutputValue(key, value);
              const isScore =
                formatted.type === 'number' &&
                (key.toLowerCase().includes('score') ||
                  key.toLowerCase().includes('rating') ||
                  key.toLowerCase().includes('confidence'));

              if (isScore) {
                return (
                  <div key={key} className="mb-4">
                    <p className="mb-1 text-sm text-gray-500">{formatted.label}</p>
                    <p className="text-5xl font-bold" style={{ color: branding.primaryColor }}>
                      {formatted.display}
                    </p>
                  </div>
                );
              }

              return (
                <div key={key} className="mt-3 border-t pt-3 text-left">
                  <p className="text-xs text-gray-500">{formatted.label}</p>
                  <p className="text-sm text-gray-900">{formatted.display}</p>
                </div>
              );
            })}
          </div>
        )}

        {template === 'data-card' && (
          <div className="divide-y rounded-lg border bg-white">
            {entries.map(([key, value]) => {
              const formatted = formatOutputValue(key, value);
              return (
                <div key={key} className="flex justify-between gap-4 px-4 py-3">
                  <span className="flex-shrink-0 text-sm text-gray-500">{formatted.label}</span>
                  <span className="text-right text-sm text-gray-900">
                    {formatted.type === 'url' ? (
                      <a
                        href={formatted.display}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 underline hover:text-indigo-500"
                      >
                        {formatted.display}
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

        {template === 'table-result' && (() => {
          const tableEntry = entries.find(
            ([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object',
          );
          if (!tableEntry) return null;

          const rows = tableEntry[1] as Record<string, unknown>[];
          const columns = Object.keys(rows[0]);

          return (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500"
                      >
                        {col.replace(/[_-]/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 25).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-2 text-gray-900">
                          {String(row[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 25 && (
                <p className="py-2 text-center text-xs text-gray-400">Showing 25 of {rows.length} results</p>
              )}
            </div>
          );
        })()}

        {template === 'download-result' && (() => {
          const urlEntry = entries.find(
            ([k, v]) =>
              typeof v === 'string' &&
              (v.startsWith('http://') || v.startsWith('https://')) &&
              (k.toLowerCase().includes('url') ||
                k.toLowerCase().includes('link') ||
                k.toLowerCase().includes('download') ||
                k.toLowerCase().includes('file')),
          );

          return (
            <div className="rounded-lg border bg-white p-6 text-center">
              {entries
                .filter(([k]) => k !== urlEntry?.[0])
                .map(([key, value]) => {
                  const formatted = formatOutputValue(key, value);
                  return (
                    <div key={key} className="mb-3 text-left">
                      <p className="text-xs text-gray-500">{formatted.label}</p>
                      <p className="text-sm text-gray-900">{formatted.display}</p>
                    </div>
                  );
                })}

              {urlEntry && (
                <a
                  href={String(urlEntry[1])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <Download className="h-4 w-4" />
                  Download Result
                </a>
              )}
            </div>
          );
        })()}

        <button
          onClick={handleReset}
          className="text-sm text-gray-500 underline transition-colors hover:text-gray-700"
        >
          Run again with different inputs
        </button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.agencyName}
              className="h-8 w-auto object-contain"
            />
          )}
          <span className="text-sm font-medium text-gray-600">{branding.agencyName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          {product.description && <p className="mt-2 text-lg text-gray-500">{product.description}</p>}
          {product.pricingType !== 'free' && product.priceCents && (
            <div className="mt-3">
              <span
                className="inline-block rounded-full px-4 py-1 text-sm font-semibold text-white"
                style={{ backgroundColor: branding.primaryColor }}
              >
                ${(product.priceCents / 100).toFixed(2)}
                {product.pricingType === 'monthly'
                  ? '/month'
                  : product.pricingType === 'per_run'
                    ? '/run'
                    : ''}
              </span>
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8"
        >
          <AnimatePresence mode="wait">
            {executionState === 'idle' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {product.inputSchema.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="mb-4 text-gray-500">
                      This workflow doesn&apos;t require any input. Click below to run it.
                    </p>
                    <button
                      onClick={handleSubmit}
                      className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      Run Workflow
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {product.inputSchema.map((field) => renderField(field))}

                    <button
                      onClick={handleSubmit}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {product.pricingType === 'free' ? (
                        <>
                          Run {product.name}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Pay &amp; Run
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {executionState === 'running' && (
              <motion.div
                key="running"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 className="h-10 w-10" style={{ color: branding.primaryColor }} />
                </motion.div>
                <p className="mt-4 font-medium text-gray-600">Running your workflow...</p>
                <p className="mt-1 text-sm text-gray-400">This usually takes a few seconds</p>
              </motion.div>
            )}

            {executionState === 'success' && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {renderResults()}
              </motion.div>
            )}

            {executionState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
                <p className="font-semibold text-gray-900">Something went wrong</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Powered by{' '}
          <a
            href="https://getflowetic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-gray-600"
          >
            Getflowetic
          </a>
        </p>
      </main>
    </div>
  );
}
