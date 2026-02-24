"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export default function PricingCardsRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const radius = dt.borderRadius ?? 8;
  const tiers = component.props?.tiers ?? [
    { name: "Starter", price: "$29", period: "/mo", features: ["5 dashboards", "Basic analytics", "Email support"], highlighted: false },
    { name: "Pro", price: "$99", period: "/mo", features: ["Unlimited dashboards", "Advanced analytics", "Priority support", "Custom branding"], highlighted: true },
    { name: "Enterprise", price: "Custom", period: "", features: ["Everything in Pro", "Dedicated manager", "SLA guarantee"], highlighted: false },
  ];

  return (
    <div className={`transition-all duration-200 ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : ""}`} data-component-type="PricingCards" onClick={isEditing ? onClick : undefined}>
      <div className={`grid gap-4 ${deviceMode === "mobile" ? "grid-cols-1" : "grid-cols-3"}`}>
        {tiers.map((tier: any, idx: number) => (
          <div key={idx} className="border p-6 flex flex-col" style={{ ...cardStyle, ...(tier.highlighted ? { borderColor: primary, borderWidth: "2px", transform: "scale(1.02)" } : {}) }}>
            {tier.highlighted && <div className="text-xs font-bold uppercase tracking-wider mb-2 px-2 py-1 rounded-full self-start" style={{ backgroundColor: `${primary}15`, color: primary }}>Most Popular</div>}
            <h4 className="text-lg font-bold" style={{ color: textColor, fontFamily: headingFont || undefined }}>{tier.name}</h4>
            <div className="flex items-baseline gap-1 mt-2 mb-4">
              <span className="text-3xl font-bold" style={{ color: primary, fontFamily: headingFont || undefined }}>{tier.price}</span>
              <span className="text-sm" style={{ color: `${textColor}66` }}>{tier.period}</span>
            </div>
            <ul className="space-y-2 flex-1 mb-4">
              {(tier.features || []).map((f: string, fi: number) => (<li key={fi} className="text-sm flex items-center gap-2" style={{ color: `${textColor}cc`, fontFamily: bodyFont || undefined }}><span style={{ color: "#22c55e" }}>✓</span> {f}</li>))}
            </ul>
            <button className="w-full py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: tier.highlighted ? primary : "transparent", color: tier.highlighted ? "#ffffff" : primary, border: tier.highlighted ? "none" : `2px solid ${primary}`, borderRadius: `${radius}px` }}>Get Started</button>
          </div>
        ))}
      </div>
    </div>
  );
}
