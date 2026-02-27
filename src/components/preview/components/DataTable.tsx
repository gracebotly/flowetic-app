"use client";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Search, Trash2 } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle } from "../componentRegistry";

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

function isStatusColumn(key: string): boolean {
  return /^(status|state|result|health|condition)$/i.test(key);
}

function renderCellValue(key: string, value: any): React.ReactNode {
  const str = String(value ?? "—");
  if (isStatusColumn(key)) {
    const cfg = STATUS_BADGE_COLORS[str.toLowerCase()];
    if (cfg) {
      return (
        <span
          className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {str}
        </span>
      );
    }
  }
  return <span className="truncate">{str}</span>;
}

function compareValue(a: any, b: any) {
  const na = Number(a);
  const nb = Number(b);
  const bothNumeric = Number.isFinite(na) && Number.isFinite(nb);
  if (bothNumeric) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

export function DataTableRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const { props, id } = component;
  const title = props?.title ?? id;
  const maxCols = deviceMode === "mobile" ? 3 : 5;
  const columns = props?.columns ?? ["ID", "Name", "Status", "Date"];
  const visibleColumns = columns.slice(0, maxCols);
  const columnLabels = visibleColumns.map((c: any) => (typeof c === "string" ? c : c.label || c.key));
  const columnKeys: string[] = visibleColumns.map((c: any) => (typeof c === "string" ? c : c.key));
  const rows = props?.rows ?? [];
  const showActions = props?.showActions;
  const maxRows = 10;

  const processedRows = useMemo(() => {
    let nextRows = [...rows];

    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase();
      nextRows = nextRows.filter((row: Record<string, any>) =>
        columnKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle))
      );
    }

    if (sortConfig) {
      nextRows.sort((a: Record<string, any>, b: Record<string, any>) => {
        const cmp = compareValue(a[sortConfig.key], b[sortConfig.key]);
        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }

    return nextRows;
  }, [rows, searchQuery, sortConfig, columnKeys]);

  const toggleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const visibleRows = processedRows.slice(0, maxRows);

  return (
    <div
      className={`h-full transition-all duration-200 ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isCardHovered ? cardHoverStyle : {}) }}
      data-component-type="DataTable"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold" style={{ color: textColor, fontFamily: headingFont || undefined }}>
            {title}
          </h3>
          <span className="text-[10px]" style={{ color: `${textColor}66` }}>
            {processedRows.length} row{processedRows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="relative mb-2">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: `${textColor}66` }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-6 pr-2 rounded-md text-xs bg-transparent"
            style={{ border: `1px solid ${textColor}1f`, color: textColor, fontFamily: bodyFont || undefined }}
            placeholder="Search rows"
          />
        </div>

        <div className="min-h-[120px] text-xs overflow-x-auto" style={{ fontFamily: bodyFont || undefined }}>
          <div
            className="grid gap-2 font-semibold pb-2 mb-1 text-[10px] uppercase tracking-wider"
            style={{
              gridTemplateColumns: `repeat(${columnLabels.length + (showActions ? 1 : 0)}, 1fr)`,
              borderBottom: `2px solid ${primary}20`,
              color: `${textColor}66`,
            }}
          >
            {columnLabels.map((col: string, i: number) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSort(columnKeys[i]);
                }}
                className="truncate px-1 text-left flex items-center gap-1"
              >
                {col}
                <ArrowUpDown size={10} />
              </button>
            ))}
            {showActions && <div className="truncate px-1">Actions</div>}
          </div>

          {visibleRows.length > 0 ? (
            visibleRows.map((row: Record<string, any>, rowIdx: number) => {
              const isRowHovered = hoveredRow === rowIdx;
              return (
                <div
                  key={rowIdx}
                  className="grid gap-2 py-2 px-1 rounded-md transition-colors duration-150"
                  style={{
                    gridTemplateColumns: `repeat(${columnLabels.length + (showActions ? 1 : 0)}, 1fr)`,
                    backgroundColor: isRowHovered
                      ? `${primary}08`
                      : rowIdx % 2 === 1
                        ? `${textColor}03`
                        : "transparent",
                    borderBottom: `1px solid ${textColor}06`,
                    color: `${textColor}cc`,
                  }}
                  onMouseEnter={() => setHoveredRow(rowIdx)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {columnKeys.map((key: string, cellIdx: number) => (
                    <div key={cellIdx} className="truncate px-1 self-center">
                      {renderCellValue(key, row[key])}
                    </div>
                  ))}
                  {showActions && (
                    <div className="flex items-center gap-2 px-1">
                      <Pencil size={12} className="cursor-pointer transition-colors" style={{ color: `${primary}80` }} />
                      <Trash2 size={12} className="cursor-pointer transition-colors" style={{ color: "#ef444480" }} />
                    </div>
                  )}
                </div>
              );
            })
          ) : rows.length > 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: `${textColor}66` }}>
              No rows match your search.
            </div>
          ) : (
            [1, 2, 3].map((rowIdx) => (
              <div key={rowIdx} className="grid gap-2 py-2" style={{ gridTemplateColumns: `repeat(${columnLabels.length}, 1fr)` }}>
                {columnLabels.map((_: any, cellIdx: number) => (
                  <div key={cellIdx} className="h-3 rounded animate-pulse" style={{ backgroundColor: `${textColor}08` }} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
