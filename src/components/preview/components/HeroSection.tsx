"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";

export default function HeroSectionRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const radius = dt.borderRadius ?? 8;
  const { props } = component;
  const headline = props?.headline ?? props?.title ?? "Your Product";
  const subheadline = props?.subheadline ?? "Powered by AI automation";
  const ctaText = props?.ctaText ?? "Get Started";

  return (
    <div className={`relative overflow-hidden transition-all duration-200 ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} style={{ borderRadius: `${radius}px`, background: `linear-gradient(135deg, ${primary}, ${primary}cc)`, minHeight: deviceMode === "mobile" ? "200px" : "280px" }} data-component-type="HeroSection" onClick={isEditing ? onClick : undefined}>
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
      <div className={`relative z-10 flex flex-col justify-center h-full ${deviceMode === "mobile" ? "p-6 text-center" : "p-10"}`}>
        <h1 className={`font-bold mb-3 ${deviceMode === "mobile" ? "text-2xl" : "text-4xl"}`} style={{ color: "#ffffff", fontFamily: headingFont || undefined }}>{headline}</h1>
        <p className={`mb-6 ${deviceMode === "mobile" ? "text-base" : "text-lg"}`} style={{ color: "rgba(255,255,255,0.85)", fontFamily: bodyFont || undefined }}>{subheadline}</p>
        <div className={deviceMode === "mobile" ? "flex justify-center" : ""}>
          <button className="px-6 py-3 font-semibold rounded-lg transition-transform hover:scale-105" style={{ backgroundColor: "#ffffff", color: primary, borderRadius: `${radius}px`, fontFamily: bodyFont || undefined }}>{ctaText} →</button>
        </div>
      </div>
    </div>
  );
}
