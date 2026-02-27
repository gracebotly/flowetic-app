"use client";

import React, { useMemo } from "react";
import { X, Filter } from "lucide-react";
import type { ActionResult } from "@/lib/actions/actionRegistry";

interface DrillDownModalProps {
  result: ActionResult;
  onClose: () => void;
  dashboardTitle?: string;
}

export function DrillDownModal({ result, onClose, dashboardTitle }: DrillDownModalProps) {
  const events = result.filteredEvents ?? [];
  const filter = result.appliedFilter;

  const { columns, rows } = useMemo(() => {
    if (events.length === 0) return { columns: [], rows: [] };

    const INTERNAL = new Set([
      "id", "tenant_id", "source_id", "interface_id", "run_id",
      "platform_event_id", "_enrichmentNote",
    ]);

    const cols = Object.keys(events[0])
      .filter((k) => !INTERNAL.has(k))
      .slice(0, 6);

    const tableRows = events.slice(0, 20).map((e) => {
      const row: Record<string, string> = {};
      cols.forEach((col) => {
        const val = e[col];
        if (val && typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
          row[col] = new Date(val).toLocaleString();
        } else {
          row[col] = val == null ? "—" : String(val);
        }
      });
      return row;
    });

    return { columns: cols, rows: tableRows };
  }, [events]);

  const numericColumns = useMemo(() => {
    if (events.length === 0) return [];
    return Object.keys(events[0]).filter((k) => {
      const vals = events.slice(0, 10).map((e) => e[k]);
      return vals.some((v) => typeof v === "number" || (!isNaN(Number(v)) && v !== null && v !== ""));
    }).slice(0, 3);
  }, [events]);

  const stats = useMemo(() => {
    return numericColumns.map((col) => {
      const nums = events.map((e) => Number(e[col])).filter((n) => !isNaN(n));
      const avg = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0;
      return { label: col.replace(/_/g, " "), value: avg, count: nums.length };
    });
  }, [events, numericColumns]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-3xl max-h-[80vh] rounded-xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          backgroundColor: "var(--gf-surface, #ffffff)",
          border: "1px solid var(--gf-border, #e5e7eb)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--gf-border, #e5e7eb)" }}>
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: "var(--gf-primary, #3b82f6)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--gf-text, #111827)" }}>
              {filter ? `Drill Down: ${filter.key} = ${filter.value}` : `Drill Down: ${dashboardTitle || "All Events"}`}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--gf-primary, #3b82f6)", color: "#ffffff" }}
            >
              {events.length} result{events.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70 transition-opacity" style={{ color: "var(--gf-muted, #6b7280)" }}>
            <X size={16} />
          </button>
        </div>

        {stats.length > 0 && (
          <div className="flex gap-4 px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--gf-border, #e5e7eb)" }}>
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-lg font-bold" style={{ color: "var(--gf-primary, #3b82f6)" }}>
                  {stat.value}
                </div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--gf-muted, #6b7280)" }}>
                  avg {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto px-5 py-3">
          {columns.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: "var(--gf-muted, #6b7280)" }}>
              No events to display
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider"
                      style={{ color: "var(--gf-muted, #6b7280)", borderBottom: "1px solid var(--gf-border, #e5e7eb)" }}
                    >
                      {col.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-2 py-1.5 truncate max-w-[200px]"
                        style={{ color: "var(--gf-text, #111827)", borderBottom: "1px solid var(--gf-border, #e5e7eb)" }}
                      >
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {events.length > 20 && (
            <div className="text-center py-2 text-[10px]" style={{ color: "var(--gf-muted, #6b7280)" }}>
              Showing 20 of {events.length} results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
