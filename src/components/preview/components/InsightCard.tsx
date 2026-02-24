"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export default function InsightCardRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const accent = dt.colors?.accent ?? "#14B8A6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const { props } = component;
  const title = props?.title ?? "Key Insight";
  const narrative = props?.narrative ?? "Analyzing your data...";
  const computedValue = props?.computedValue ?? props?.value ?? "—";
  const trend = props?.trend;
  const trendDelta = props?.trendDelta;

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={{ ...cardStyle, borderLeft: `4px solid ${accent}` }} data-component-type="InsightCard" onClick={isEditing ? onClick : undefined}>
      <div className={deviceMode === "mobile" ? "p-4" : "p-6"}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-bold" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          {trend && (
            <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: trend === "up" ? "#dcfce7" : trend === "down" ? "#fee2e2" : `${textColor}10`, color: trend === "up" ? "#16a34a" : trend === "down" ? "#dc2626" : textColor }}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendDelta || ""}
            </span>
          )}
        </div>
        <div className="text-4xl font-bold mb-3" style={{ color: primary, fontFamily: headingFont || undefined }}>{computedValue}</div>
        <p className="text-sm leading-relaxed" style={{ color: `${textColor}88`, fontFamily: bodyFont || undefined }}>{narrative}</p>
      </div>
    </div>
  );
}
