"use client";
import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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

function renderCellValue(key: string, value: any, textColor: string): React.ReactNode {
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

export function DataTableRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const { props, id } = component;
  const title = props?.title ?? id;
  const maxCols = deviceMode === "mobile" ? 3 : 5;
  const columns = props?.columns ?? ["ID", "Name", "Status", "Date"];
  const columnLabels = columns.slice(0, maxCols).map((c: any) => typeof c === "string" ? c : c.label || c.key);
  const columnKeys = columns.slice(0, maxCols).map((c: any) => typeof c === "string" ? c : c.key);
  const rows = props?.rows;
  const showActions = props?.showActions;
  const maxRows = deviceMode === "mobile" ? 3 : 5;

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
        <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>
          {title}
        </h3>
        <div className="min-h-[120px] text-xs overflow-x-auto" style={{ fontFamily: bodyFont || undefined }}>
          {/* Table header */}
          <div
            className="grid gap-2 font-semibold pb-2 mb-1 text-[10px] uppercase tracking-wider"
            style={{
              gridTemplateColumns: `repeat(${columnLabels.length + (showActions ? 1 : 0)}, 1fr)`,
              borderBottom: `2px solid ${primary}20`,
              color: `${textColor}66`,
            }}
          >
            {columnLabels.map((col: string, i: number) => (
              <div key={i} className="truncate px-1">{col}</div>
            ))}
            {showActions && <div className="truncate px-1">Actions</div>}
          </div>

          {/* Table rows */}
          {rows && rows.length > 0 ? (
            rows.slice(0, maxRows).map((row: Record<string, any>, rowIdx: number) => {
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
                      {renderCellValue(key, row[key], textColor)}
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
          ) : (
            /* Skeleton rows */
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
