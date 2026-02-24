"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export default function AuthFormRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const radius = dt.borderRadius ?? 8;
  const title = component.props?.title ?? "Sign In";

  return (
    <div className={`h-full flex items-center justify-center transition-all duration-200 ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} data-component-type="AuthForm" onClick={isEditing ? onClick : undefined}>
      <div className="w-full max-w-sm border p-8" style={cardStyle}>
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h2>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium mb-1" style={{ color: `${textColor}88`, fontFamily: bodyFont || undefined }}>Email</label><div className="h-10 rounded-lg border" style={{ borderColor: `${textColor}20`, borderRadius: `${radius}px`, backgroundColor: `${textColor}04` }} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: `${textColor}88`, fontFamily: bodyFont || undefined }}>Password</label><div className="h-10 rounded-lg border" style={{ borderColor: `${textColor}20`, borderRadius: `${radius}px`, backgroundColor: `${textColor}04` }} /></div>
          <button className="w-full py-2.5 rounded-lg font-semibold text-white text-sm" style={{ backgroundColor: primary, borderRadius: `${radius}px` }}>{title}</button>
        </div>
        <p className="text-xs text-center mt-4" style={{ color: `${textColor}55`, fontFamily: bodyFont || undefined }}>Don&apos;t have an account? <span style={{ color: primary }}>Sign up</span></p>
      </div>
    </div>
  );
}
