"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";

export default function PageHeaderRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const title = component.props?.title ?? "Page Title";

  return (
    <div className={`flex items-center justify-between py-4 transition-all duration-200 ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} style={{ borderBottom: `2px solid ${primary}20` }} data-component-type="PageHeader" onClick={isEditing ? onClick : undefined}>
      <h2 className={`font-bold ${deviceMode === "mobile" ? "text-xl" : "text-2xl"}`} style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h2>
      <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: primary }}>+ New</button>
    </div>
  );
}
