"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface PayloadViewerProps {
  data: Record<string, unknown> | null;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function CollapsibleSection({
  label,
  value,
  defaultOpen = false,
}: {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isNested = isObject(value) || Array.isArray(value);

  if (!isNested) {
    return (
      <div className="flex items-start gap-2 py-1">
        <span className="shrink-0 text-xs font-medium text-gray-500">
          {label}:
        </span>
        <span className="text-xs text-gray-900 break-all">
          {value === null
            ? "null"
            : value === undefined
              ? "undefined"
              : String(value)}
        </span>
      </div>
    );
  }

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
        <span className="text-gray-400">
          {Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value as Record<string, unknown>).length}}`}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-gray-100 pl-3 mt-1">
          {Array.isArray(value)
            ? value.map((item, i) => (
                <CollapsibleSection
                  key={i}
                  label={`[${i}]`}
                  value={item}
                  defaultOpen={false}
                />
              ))
            : Object.entries(value as Record<string, unknown>).map(
                ([k, v]) => (
                  <CollapsibleSection
                    key={k}
                    label={k}
                    value={v}
                    defaultOpen={false}
                  />
                ),
              )}
        </div>
      )}
    </div>
  );
}

export function PayloadViewer({ data }: PayloadViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">No payload data available.</p>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Payload
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy JSON
            </>
          )}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {Object.entries(data).map(([key, value]) => (
          <CollapsibleSection
            key={key}
            label={key}
            value={value}
            defaultOpen={Object.keys(data).length <= 5}
          />
        ))}
      </div>
    </div>
  );
}
