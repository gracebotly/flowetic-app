"use client";
import React from "react";
import { AreaChart } from "@tremor/react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

export function LineChartRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const cardStyle = buildCardStyle(dt);
  const { props, id } = component;
  const title = props?.title ?? id;
  const chartData = props?.data ?? [{ date: "Jan", value: 100 }, { date: "Feb", value: 150 }, { date: "Mar", value: 120 }, { date: "Apr", value: 180 }];

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type="LineChart" onClick={isEditing ? onClick : undefined}>
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
        <div className="min-h-[200px]">
          <AreaChart className="h-full" data={chartData} index="date" categories={["value"]} colors={[primary]} showLegend={false} showGridLines={false} showYAxis={deviceMode !== "mobile"} curveType="natural" />
        </div>
      </div>
    </div>
  );
}
