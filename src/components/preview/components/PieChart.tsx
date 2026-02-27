"use client";
import React from "react";
import { DonutChart } from "@tremor/react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export function PieChartRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const secondary = dt.colors?.secondary ?? "#64748B";
  const accent = dt.colors?.accent ?? "#14B8A6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const cardStyle = buildCardStyle(dt);
  const { props, id } = component;
  const title = props?.title ?? id;
  const chartData = props?.data ?? [{ name: "Success", value: 75 }, { name: "Failed", value: 15 }, { name: "Pending", value: 10 }];

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type="PieChart" onClick={isEditing ? onClick : undefined}>
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
        <div className="min-h-[200px]">
          <DonutChart className="h-full" data={chartData} category="value" index="name" colors={[primary, secondary, accent]} showLabel={true} {...({ enableAnimation: true } as any)} />
        </div>
      </div>
    </div>
  );
}

export { PieChartRenderer as DonutChartRenderer };
