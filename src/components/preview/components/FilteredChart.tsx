"use client";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import { DonutChart, BarChart as TremorBar } from "@tremor/react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle, isColorDark } from "../componentRegistry";

/**
 * FilteredChart — Wraps PieChart or BarChart with null/empty filtering.
 *
 * Props (from hybridBuilder):
 *   title: string
 *   categoryField: string
 *   valueField: string        — usually "count"
 *   aggregation: string       — usually "count"
 *   innerChartType: "PieChart" | "BarChart"
 *   filterNulls: boolean      — strip null/empty/unknown rows
 *   data: Array<{ name: string; value: number }>  (set by enrichFilteredChart)
 *
 * Enrichment: enrichFilteredChart() aggregates events by categoryField,
 * strips null/empty/unknown values if filterNulls is true, and sets data.
 */
export function FilteredChartRenderer({
  component,
  designTokens: dt,
  deviceMode,
  isEditing,
  onClick,
}: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const secondary = dt.colors?.secondary ?? "#64748B";
  const accent = dt.colors?.accent ?? "#14B8A6";
  const textColor = dt.colors?.text ?? "#111827";
  const bgColor = dt.colors?.background ?? "#ffffff";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isHovered, setIsHovered] = useState(false);

  const { props, id } = component;
  const title = (props?.title as string) ?? "Distribution";
  const innerChartType = (props?.innerChartType as string) ?? "PieChart";
  const rawData: Array<{ name: string; value: number }> = props?.data ?? [];
  const filterNulls = props?.filterNulls !== false; // default true

  // Apply null filtering at render time as a safety net
  const chartData = useMemo(() => {
    if (!filterNulls) return rawData;
    return rawData.filter((d) => {
      const name = (d.name ?? "").toLowerCase().trim();
      return name !== "" && name !== "null" && name !== "undefined" && name !== "unknown" && name !== "—";
    });
  }, [rawData, filterNulls]);

  const hasData = chartData.length > 0;
  const isDark = isColorDark(bgColor);
  const filteredCount = rawData.length - chartData.length;

  // Generate color palette from design tokens
  const colorPalette = [primary, secondary, accent, "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

  return (
    <motion.div
      className={`h-full transition-all duration-200 ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isHovered ? cardHoverStyle : {}) }}
      data-component-type="FilteredChart"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: textColor, fontFamily: headingFont || undefined }}
          >
            {title}
          </h3>
          {filteredCount > 0 && (
            <span
              className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${textColor}08`, color: `${textColor}55` }}
              title={`${filteredCount} null/empty values filtered out`}
            >
              <Filter size={8} />
              {filteredCount} filtered
            </span>
          )}
        </div>

        {/* Chart */}
        {hasData ? (
          <div className="min-h-[180px]">
            {innerChartType === "PieChart" ? (
              <DonutChart
                className="h-full"
                data={chartData}
                category="value"
                index="name"
                colors={colorPalette.slice(0, chartData.length)}
                showLabel={chartData.length <= 6}
                {...({ enableAnimation: true } as any)}
              />
            ) : (
              <TremorBar
                className="h-44"
                data={chartData}
                index="name"
                categories={["value"]}
                colors={[primary]}
                showLegend={false}
                valueFormatter={(n: any) => Intl.NumberFormat("en-US").format(Number(n))}
              />
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-8 text-center min-h-[180px]">
            <Filter size={28} style={{ color: `${textColor}20` }} />
            <p className="mt-2 text-xs" style={{ color: `${textColor}44`, fontFamily: bodyFont || undefined }}>
              No data after filtering
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default FilteredChartRenderer;
