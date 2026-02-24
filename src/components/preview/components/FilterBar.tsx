"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";

export default function FilterBarRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const bodyFont = dt.fonts?.body;
  const radius = dt.borderRadius ?? 8;
  const filters = component.props?.filters ?? ["All", "Active", "Completed", "Failed"];

  return (
    <div className={`flex items-center gap-2 py-2 overflow-x-auto transition-all duration-200 ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} data-component-type="FilterBar" onClick={isEditing ? onClick : undefined}>
      {filters.map((f: string, idx: number) => (
        <button key={idx} className="px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap" style={{ backgroundColor: idx === 0 ? `${primary}15` : "transparent", color: idx === 0 ? primary : `${textColor}66`, border: `1px solid ${idx === 0 ? primary : `${textColor}20`}`, borderRadius: `${radius * 2}px`, fontFamily: bodyFont || undefined }}>{f}</button>
      ))}
    </div>
  );
}
