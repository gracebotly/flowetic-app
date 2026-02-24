"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, getIconSymbol } from "../componentRegistry";

export default function FeatureGridRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const features = component.props?.features ?? [
    { icon: "zap", title: "Fast", description: "Lightning-fast performance" },
    { icon: "shield", title: "Secure", description: "Enterprise-grade security" },
    { icon: "trending-up", title: "Growth", description: "Scale with confidence" },
  ];

  return (
    <div className={`transition-all duration-200 ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} data-component-type="FeatureGrid" onClick={isEditing ? onClick : undefined}>
      <div className={`grid gap-4 ${deviceMode === "mobile" ? "grid-cols-1" : "grid-cols-3"}`}>
        {features.map((f: any, idx: number) => (
          <div key={idx} className="border p-5" style={cardStyle}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${primary}15`, color: primary }}>{getIconSymbol(f.icon || "star")}</div>
            <h4 className="text-sm font-bold mb-1" style={{ color: textColor, fontFamily: headingFont || undefined }}>{f.title}</h4>
            <p className="text-xs" style={{ color: `${textColor}66`, fontFamily: bodyFont || undefined }}>{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
