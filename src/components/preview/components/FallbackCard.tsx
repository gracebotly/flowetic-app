"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export default function FallbackCardRenderer({ component, designTokens: dt }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);

  return (
    <div className="h-full border border-dashed flex items-center justify-center" style={{ ...cardStyle, borderStyle: "dashed", borderColor: `${primary}40` }}>
      <div className="text-center p-4">
        <div className="text-2xl mb-2">🧩</div>
        <p className="text-sm font-medium" style={{ color: `${textColor}66`, fontFamily: bodyFont || undefined }}>{component.type}</p>
        <p className="text-xs mt-1" style={{ color: `${textColor}44` }}>Component preview coming soon</p>
      </div>
    </div>
  );
}
