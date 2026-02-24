"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, getIconSymbol } from "../componentRegistry";

export function MetricCardRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const accent = dt.colors?.accent ?? "#14B8A6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const { props, id } = component;
  const title = props?.title ?? id;
  const value = props?.value ?? "—";
  const subtitle = props?.subtitle ?? props?.label ?? null;
  const hasRealValue = props?.value != null && props?.value !== "—";

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type="MetricCard" onClick={isEditing ? onClick : undefined} role={isEditing ? "button" : undefined} tabIndex={isEditing ? 0 : undefined} aria-label={isEditing ? `Edit ${title}` : undefined}>
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${primary}, ${accent || primary}dd)`, borderRadius: `${dt.borderRadius ?? 8}px ${dt.borderRadius ?? 8}px 0 0` }} />
      <div className={deviceMode === "mobile" ? "p-3" : "p-5"}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: `${textColor}88`, fontFamily: bodyFont || undefined, letterSpacing: "0.05em" }}>{title}</span>
          {props?.icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: `${primary}15`, color: primary }}>{getIconSymbol(props.icon)}</div>
          )}
        </div>
        <div className={`${deviceMode === "mobile" ? "text-2xl" : "text-3xl"} font-bold tracking-tight`} style={{ color: hasRealValue ? textColor : `${textColor}40`, fontFamily: headingFont || undefined, lineHeight: 1.2 }}>{value}</div>
        {subtitle && <div className="text-sm mt-1.5" style={{ color: `${textColor}66`, fontFamily: bodyFont || undefined }}>{subtitle}</div>}
        {props?.showTrend && props?.trend && (
          <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: props.trend === "up" ? "#22c55e" : props.trend === "down" ? "#ef4444" : `${textColor}66` }}>
            <span>{props.trend === "up" ? "↑" : props.trend === "down" ? "↓" : "→"}</span>
            <span>{props.trendDelta || ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}
