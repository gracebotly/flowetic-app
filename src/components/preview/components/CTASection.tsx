"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";

export default function CTASectionRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const radius = dt.borderRadius ?? 8;
  const headline = component.props?.headline ?? "Ready to get started?";
  const ctaText = component.props?.ctaText ?? "Start Free Trial";

  return (
    <div className={`flex items-center justify-between p-6 rounded-lg transition-all duration-200 ${deviceMode === "mobile" ? "flex-col gap-4 text-center" : ""} ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} style={{ backgroundColor: `${primary}08`, borderRadius: `${radius}px` }} data-component-type="CTASection" onClick={isEditing ? onClick : undefined}>
      <h3 className="text-lg font-bold" style={{ color: textColor, fontFamily: headingFont || undefined }}>{headline}</h3>
      <button className="px-6 py-2.5 rounded-lg font-semibold text-white transition-transform hover:scale-105" style={{ backgroundColor: primary, borderRadius: `${radius}px`, fontFamily: bodyFont || undefined }}>{ctaText}</button>
    </div>
  );
}
