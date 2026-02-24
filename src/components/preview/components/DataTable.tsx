"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export function DataTableRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const { props, id } = component;
  const title = props?.title ?? id;
  const maxCols = deviceMode === "mobile" ? 3 : 5;
  const columns = props?.columns ?? ["ID", "Name", "Status", "Date"];
  const columnLabels = columns.slice(0, maxCols).map((c: any) => typeof c === "string" ? c : c.label || c.key);
  const columnKeys = columns.slice(0, maxCols).map((c: any) => typeof c === "string" ? c : c.key);
  const rows = props?.rows;
  const showActions = props?.showActions;

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type="DataTable" onClick={isEditing ? onClick : undefined}>
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
        <div className="min-h-[120px] text-xs overflow-x-auto" style={{ fontFamily: bodyFont || undefined }}>
          <div className="grid gap-2 font-semibold pb-2 mb-1" style={{ gridTemplateColumns: `repeat(${columnLabels.length + (showActions ? 1 : 0)}, 1fr)`, borderBottom: `2px solid ${primary}30`, color: textColor }}>
            {columnLabels.map((col: string, i: number) => (<div key={i} className="truncate px-1">{col}</div>))}
            {showActions && <div className="truncate px-1">Actions</div>}
          </div>
          {rows && rows.length > 0 ? (
            rows.slice(0, deviceMode === "mobile" ? 3 : 5).map((row: Record<string, any>, rowIdx: number) => (
              <div key={rowIdx} className="grid gap-2 py-1.5 px-0" style={{ gridTemplateColumns: `repeat(${columnLabels.length + (showActions ? 1 : 0)}, 1fr)`, backgroundColor: rowIdx % 2 === 0 ? "transparent" : `${primary}05`, color: `${textColor}cc`, borderBottom: `1px solid ${textColor}08` }}>
                {columnKeys.map((key: string, cellIdx: number) => (<div key={cellIdx} className="truncate px-1">{row[key] ?? "—"}</div>))}
                {showActions && <div className="flex gap-1 px-1"><span className="text-blue-500 cursor-pointer">✏️</span><span className="text-red-400 cursor-pointer">🗑️</span></div>}
              </div>
            ))
          ) : (
            [1, 2, 3].map((rowIdx) => (
              <div key={rowIdx} className="grid gap-2 py-1.5" style={{ gridTemplateColumns: `repeat(${columnLabels.length}, 1fr)` }}>
                {columnLabels.map((_: any, cellIdx: number) => (<div key={cellIdx} className="h-3 rounded animate-pulse" style={{ backgroundColor: `${textColor}12` }} />))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
