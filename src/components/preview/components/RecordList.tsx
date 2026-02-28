"use client";
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Search, ArrowUpDown, Layers } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle, isColorDark } from "../componentRegistry";

const STATUS_BADGE_COLORS: Record<string, { color: string; bg: string }> = {
  success: { color: "#16a34a", bg: "#16a34a15" },
  completed: { color: "#16a34a", bg: "#16a34a15" },
  active: { color: "#16a34a", bg: "#16a34a15" },
  error: { color: "#dc2626", bg: "#dc262615" },
  failed: { color: "#dc2626", bg: "#dc262615" },
  warning: { color: "#f59e0b", bg: "#f59e0b15" },
  pending: { color: "#f59e0b", bg: "#f59e0b15" },
  info: { color: "#3b82f6", bg: "#3b82f615" },
  running: { color: "#3b82f6", bg: "#3b82f615" },
};

function isStatusValue(value: string): boolean {
  return STATUS_BADGE_COLORS[value.toLowerCase()] !== undefined;
}

function renderCellValue(key: string, value: any, textColor: string): React.ReactNode {
  const str = String(value ?? "—");
  if (isStatusValue(str)) {
    const cfg = STATUS_BADGE_COLORS[str.toLowerCase()];
    return (
      <span
        className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {str}
      </span>
    );
  }
  // Truncate long values
  if (str.length > 60) {
    return <span className="truncate block max-w-[200px]" title={str}>{str.slice(0, 57)}…</span>;
  }
  return <span className="truncate">{str}</span>;
}

function compareValue(a: any, b: any) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/**
 * RecordList — Browsable record table with field group columns and row expansion.
 *
 * Props (from hybridBuilder):
 *   title: string
 *   columns: Array<{ key: string; label: string; group?: string }>
 *   rows: Array<Record<string, any>>
 *   fieldGroups: { core: string[]; input: string[]; output: string[] }
 *   entityName: string
 *   maxRows: number (default 15)
 *
 * Enrichment: enrichRecordList() populates rows from events using column keys.
 */
export function RecordListRenderer({
  component,
  designTokens: dt,
  deviceMode,
  isEditing,
  onClick,
}: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const bgColor = dt.colors?.background ?? "#ffffff";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const isDark = isColorDark(bgColor);
  const { props, id } = component;
  const title = (props?.title as string) ?? "Records";
  const columns: Array<{ key: string; label: string; group?: string }> = props?.columns ?? [];
  const rows: Array<Record<string, any>> = props?.rows ?? [];
  const fieldGroups = props?.fieldGroups as { core?: string[]; input?: string[]; output?: string[] } | undefined;
  const maxRows = (props?.maxRows as number) ?? 15;
  const entityName = (props?.entityName as string) ?? "Record";

  // Limit columns for mobile
  const maxCols = deviceMode === "mobile" ? 3 : deviceMode === "tablet" ? 5 : 8;
  const visibleColumns = columns.slice(0, maxCols);
  const columnKeys = visibleColumns.map((c) => c.key);

  // Search + sort
  const processedRows = useMemo(() => {
    let next = [...rows];
    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase();
      next = next.filter((row) =>
        columnKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle))
      );
    }
    if (sortConfig) {
      next.sort((a, b) => {
        const cmp = compareValue(a[sortConfig.key], b[sortConfig.key]);
        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }
    return next;
  }, [rows, searchQuery, sortConfig, columnKeys]);

  const visibleRows = processedRows.slice(0, maxRows);
  const toggleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  // Determine which group a column belongs to (for header coloring)
  const getGroupColor = (key: string): string | undefined => {
    if (!fieldGroups) return undefined;
    if (fieldGroups.core?.includes(key)) return primary;
    if (fieldGroups.input?.includes(key)) return "#8b5cf6"; // violet
    if (fieldGroups.output?.includes(key)) return "#14b8a6"; // teal
    return undefined;
  };

  return (
    <div
      className={`h-full transition-all duration-200 ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isCardHovered ? cardHoverStyle : {}) }}
      data-component-type="RecordList"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Layers size={14} style={{ color: primary }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: textColor, fontFamily: headingFont || undefined }}
            >
              {title}
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${primary}12`, color: primary }}>
              {processedRows.length}
            </span>
          </div>

          {/* Search */}
          {rows.length > 3 && (
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: `${textColor}40` }} />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-[11px] pl-6 pr-2 py-1 rounded-md border outline-none transition-colors"
                style={{
                  borderColor: `${textColor}15`,
                  backgroundColor: `${textColor}04`,
                  color: textColor,
                  fontFamily: bodyFont || undefined,
                  width: deviceMode === "mobile" ? "100px" : "140px",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${primary}50`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = `${textColor}15`; }}
              />
            </div>
          )}
        </div>

        {/* Field group legend */}
        {fieldGroups && deviceMode !== "mobile" && (
          <div className="flex gap-3 mb-2">
            {fieldGroups.core && fieldGroups.core.length > 0 && (
              <span className="text-[9px] flex items-center gap-1" style={{ color: `${textColor}66` }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primary }} /> Core
              </span>
            )}
            {fieldGroups.input && fieldGroups.input.length > 0 && (
              <span className="text-[9px] flex items-center gap-1" style={{ color: `${textColor}66` }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#8b5cf6" }} /> Input
              </span>
            )}
            {fieldGroups.output && fieldGroups.output.length > 0 && (
              <span className="text-[9px] flex items-center gap-1" style={{ color: `${textColor}66` }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#14b8a6" }} /> Output
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto" style={{ fontSize: deviceMode === "mobile" ? "10px" : "11px" }}>
          {/* Column headers */}
          <div
            className="grid gap-2 py-1.5 border-b"
            style={{
              gridTemplateColumns: `24px repeat(${visibleColumns.length}, 1fr)`,
              borderColor: `${textColor}10`,
            }}
          >
            <div /> {/* Expand toggle spacer */}
            {visibleColumns.map((col, idx) => {
              const groupColor = getGroupColor(col.key);
              return (
                <div
                  key={idx}
                  className="font-semibold truncate px-1 cursor-pointer select-none flex items-center gap-1"
                  style={{ color: `${textColor}88`, fontFamily: headingFont || undefined }}
                  onClick={() => toggleSort(col.key)}
                >
                  {groupColor && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                  )}
                  <span className="truncate">{col.label}</span>
                  <ArrowUpDown size={10} style={{ color: `${textColor}30`, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {visibleRows.length > 0 ? (
            visibleRows.map((row, rowIdx) => {
              const isExpanded = expandedRow === rowIdx;
              const isRowHovered = hoveredRow === rowIdx;
              return (
                <React.Fragment key={rowIdx}>
                  <div
                    className="grid gap-2 py-2 px-0.5 rounded-md transition-colors duration-150 cursor-pointer"
                    style={{
                      gridTemplateColumns: `24px repeat(${visibleColumns.length}, 1fr)`,
                      backgroundColor: isExpanded
                        ? `${primary}06`
                        : isRowHovered
                          ? `${primary}04`
                          : rowIdx % 2 === 1
                            ? `${textColor}02`
                            : "transparent",
                      borderBottom: `1px solid ${textColor}06`,
                      color: `${textColor}cc`,
                    }}
                    onMouseEnter={() => setHoveredRow(rowIdx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => setExpandedRow(isExpanded ? null : rowIdx)}
                  >
                    {/* Expand toggle */}
                    <div className="flex items-center justify-center">
                      {isExpanded
                        ? <ChevronDown size={12} style={{ color: primary }} />
                        : <ChevronRight size={12} style={{ color: `${textColor}30` }} />
                      }
                    </div>
                    {columnKeys.map((key, cellIdx) => (
                      <div key={cellIdx} className="truncate px-1 self-center" style={{ fontFamily: bodyFont || undefined }}>
                        {renderCellValue(key, row[key], textColor)}
                      </div>
                    ))}
                  </div>

                  {/* Expanded detail row */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="grid grid-cols-2 gap-x-4 gap-y-1.5 py-3 px-6 mb-1 rounded-b-md"
                          style={{ backgroundColor: `${primary}04`, borderTop: `1px solid ${primary}12` }}
                        >
                          {Object.entries(row)
                            .filter(([k]) => !columnKeys.includes(k) && k !== "_enrichmentNote")
                            .slice(0, 12)
                            .map(([k, v]) => (
                              <div key={k} className="flex flex-col">
                                <span className="text-[9px] font-medium" style={{ color: `${textColor}55` }}>{k}</span>
                                <span className="text-[11px] truncate" style={{ color: `${textColor}cc` }}>
                                  {String(v ?? "—")}
                                </span>
                              </div>
                            ))
                          }
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })
          ) : rows.length > 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: `${textColor}66` }}>
              No records match your search.
            </div>
          ) : (
            /* Empty skeleton rows */
            [1, 2, 3].map((rowIdx) => (
              <div
                key={rowIdx}
                className="grid gap-2 py-2"
                style={{ gridTemplateColumns: `24px repeat(${visibleColumns.length || 3}, 1fr)` }}
              >
                <div />
                {(visibleColumns.length > 0 ? visibleColumns : [1, 2, 3]).map((_, cellIdx) => (
                  <div
                    key={cellIdx}
                    className="h-3 rounded animate-pulse"
                    style={{ backgroundColor: `${textColor}08` }}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer: row count */}
        {processedRows.length > maxRows && (
          <div className="mt-2 text-[10px] text-right" style={{ color: `${textColor}44` }}>
            Showing {visibleRows.length} of {processedRows.length} records
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordListRenderer;
