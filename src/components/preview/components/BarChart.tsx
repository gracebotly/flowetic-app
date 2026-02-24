"use client";
import React from "react";
import { BarChart } from "@tremor/react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export function BarChartRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const secondary = dt.colors?.secondary ?? "#64748B";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const cardStyle = buildCardStyle(dt);
  const { props, id } = component;
  const title = props?.title ?? id;
  const chartData = props?.data ?? [{ name: "A", value: 40 }, { name: "B", value: 65 }, { name: "C", value: 50 }, { name: "D", value: 80 }];

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type="BarChart" onClick={isEditing ? onClick : undefined}>
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
        <div className="min-h-[200px]">
          <BarChart className="h-full" data={chartData} index="name" categories={["value"]} colors={[primary, secondary]} showLegend={false} showGridLines={false} />
        </div>
      </div>
    </div>
  );
}
