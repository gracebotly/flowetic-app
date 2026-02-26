"use client";
import React from "react";
import { BarChart } from "@tremor/react";
import { BarChart3 } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle } from "../componentRegistry";

export function BarChartRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const secondary = dt.colors?.secondary ?? "#64748B";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isHovered, setIsHovered] = React.useState(false);
  const { props, id } = component;
  const title = props?.title ?? id;
  const chartData = props?.data ?? [{ name: "A", value: 40 }, { name: "B", value: 65 }, { name: "C", value: 50 }, { name: "D", value: 80 }];
  const isSparseData = chartData.length <= 1;

  return (
    <div
      className={`h-full transition-all duration-200 ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isHovered ? cardHoverStyle : {}) }}
      data-component-type="BarChart"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          {isSparseData && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${primary}10`, color: primary }}>
              Limited data
            </span>
          )}
        </div>

        {isSparseData ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${primary}15, ${primary}08)`, border: `1px solid ${primary}12` }}>
              <BarChart3 size={24} color={primary} strokeWidth={1.5} />
            </div>
            <div className="text-4xl font-bold mb-2" style={{ color: textColor, fontFamily: headingFont || undefined }}>
              {chartData[0]?.value ?? 0}
            </div>
            <div className="text-xs" style={{ color: `${textColor}55`, fontFamily: bodyFont || undefined }}>
              {chartData.length === 1 ? `Single data point · ${chartData[0]?.name ?? ""}` : `${chartData.length} data points available`}
            </div>
          </div>
        ) : (
          <div
            className="min-h-[200px]"
            style={
              {
                '--tremor-brand': primary,
              } as React.CSSProperties
            }
          >
            <BarChart
              className="h-full [&_.tremor-BarChart-bar]:fill-[var(--tremor-brand)]"
              data={chartData}
              index="name"
              categories={["value"]}
              colors={["blue", "slate"]}
              showLegend={false}
              showGridLines={false}
              style={
                {
                  '--color-blue-500': primary,
                  '--color-blue-400': `${primary}cc`,
                  '--color-blue-300': `${primary}66`,
                  '--color-slate-500': secondary,
                } as React.CSSProperties
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
