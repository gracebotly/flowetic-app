"use client";
import React, { useState } from "react";
import { AreaChart } from "@tremor/react";
import { TrendingUp } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle } from "../componentRegistry";

export function LineChartRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const { props, id } = component;
  const primary = dt.colors?.primary ?? "#3b82f6";
  const emphasisColor = (props?.emphasisColor as string) ?? primary;
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isHovered, setIsHovered] = useState(false);

  const title = props?.title ?? id;
  const chartData = props?.data ?? [
    { date: "Jan", value: 100 },
    { date: "Feb", value: 150 },
    { date: "Mar", value: 120 },
    { date: "Apr", value: 180 },
  ];

  const isSparseData = chartData.length <= 2;

  return (
    <div
      className={`h-full transition-all duration-200 ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isHovered ? cardHoverStyle : {}) }}
      data-component-type="LineChart"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold"
            style={{ color: textColor, fontFamily: headingFont || undefined }}
          >
            {title}
          </h3>
          {isSparseData && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${primary}10`, color: primary }}
            >
              Limited data
            </span>
          )}
        </div>

        {isSparseData ? (
          /* Sparse data: show a prominent stat instead of a broken chart */
          <div className="min-h-[200px] flex flex-col items-center justify-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, ${primary}15, ${primary}08)`,
                border: `1px solid ${primary}12`,
              }}
            >
              <TrendingUp size={24} color={primary} strokeWidth={1.5} />
            </div>
            <div
              className="text-4xl font-bold mb-2"
              style={{ color: textColor, fontFamily: headingFont || undefined }}
            >
              {chartData[0]?.value ?? 0}
            </div>
            <div
              className="text-xs"
              style={{ color: `${textColor}55`, fontFamily: bodyFont || undefined }}
            >
              {chartData.length === 1
                ? `Single data point · ${chartData[0]?.date ?? ""}`
                : `${chartData.length} data points available`}
            </div>
            <div
              className="text-[10px] mt-3 px-3 py-1 rounded-full"
              style={{ backgroundColor: `${textColor}06`, color: `${textColor}44` }}
            >
              Chart will populate as more data arrives
            </div>
          </div>
        ) : (
          /* Normal: render the Tremor chart */
          <div className="min-h-[200px]">
            <AreaChart
              className="h-full"
              data={chartData}
              index="date"
              categories={["value"]}
              colors={[emphasisColor]}
              showLegend={false}
              showGridLines={false}
              showYAxis={deviceMode !== "mobile"}
              curveType="natural"
            />
          </div>
        )}
      </div>
    </div>
  );
}
