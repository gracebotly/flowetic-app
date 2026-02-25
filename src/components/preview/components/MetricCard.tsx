"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, TrendingUp, Zap, Clock, Timer,
  Users, User, CheckCircle, CheckCircle2, AlertTriangle,
  DollarSign, Percent, Hash, Database, Server, Cpu, Settings,
  Shield, Lock, Key, Mail, Inbox, Star, Heart, Globe, Link,
  PieChart as PieChartIcon, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle } from "../componentRegistry";

// Lucide icon lookup
const ICON_MAP: Record<string, LucideIcon> = {
  activity: Activity, "bar-chart": BarChart3, "pie-chart": PieChartIcon,
  "line-chart": TrendingUp, trending: TrendingUp, "trending-up": TrendingUp,
  zap: Zap, clock: Clock, timer: Timer,
  users: Users, user: User,
  check: CheckCircle, "check-circle": CheckCircle2,
  alert: AlertTriangle, "alert-triangle": AlertTriangle,
  dollar: DollarSign, money: DollarSign,
  percent: Percent, hash: Hash,
  database: Database, server: Server, cpu: Cpu, settings: Settings,
  shield: Shield, lock: Lock, key: Key,
  mail: Mail, inbox: Inbox, star: Star, heart: Heart,
  globe: Globe, link: Link,
};

function AnimatedValue({ value, textColor, font }: { value: string; textColor: string; font?: string }) {
  return (
    <motion.span
      key={value}
      style={{ color: textColor, fontFamily: font || undefined, lineHeight: 1.1 }}
      initial={{ opacity: 0.6, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {value}
    </motion.span>
  );
}

export function MetricCardRenderer({ component, designTokens: dt, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const accent = dt.colors?.accent ?? primary;
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isHovered, setIsHovered] = useState(false);

  const { props, id } = component;
  const title = (props?.title as string) ?? id;
  const value = String(props?.value ?? "—");
  const subtitle = (props?.subtitle as string) ?? (props?.label as string) ?? null;
  const hasRealValue = props?.value != null && props?.value !== "—";
  const iconName = String(props?.icon ?? "activity").toLowerCase();
  const icon = ICON_MAP[iconName] ?? Activity;

  const trend = props?.trend;
  const trendDelta = props?.trendDelta;

  return (
    <motion.div
      className={`h-full ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isHovered ? cardHoverStyle : {}) }}
      data-component-type="MetricCard"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={isEditing ? "button" : undefined}
      tabIndex={isEditing ? 0 : undefined}
      aria-label={isEditing ? `Edit ${title}` : undefined}
      whileTap={isEditing ? { scale: 0.98 } : undefined}
    >
      <div
        style={{
          height: "3px",
          background: `linear-gradient(90deg, ${primary}, ${accent}cc)`,
          borderRadius: `${dt.borderRadius ?? 8}px ${dt.borderRadius ?? 8}px 0 0`,
        }}
      />

      <div className="p-4 @[300px]:p-5 flex flex-col justify-between h-[calc(100%-3px)]">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: `${textColor}70`, fontFamily: bodyFont || undefined, letterSpacing: "0.06em" }}
          >
            {title}
          </span>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${primary}18, ${primary}08)`,
              border: `1px solid ${primary}15`,
            }}
          >
            {React.createElement(icon, { size: 16, color: primary, strokeWidth: 2 })}
          </div>
        </div>

        <div className="text-3xl @[300px]:text-4xl font-bold tracking-tight mb-1">
          {hasRealValue ? (
            <AnimatedValue value={value} textColor={textColor} font={headingFont} />
          ) : (
            <span style={{ color: `${textColor}30`, fontFamily: headingFont || undefined }}>—</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          {subtitle && (
            <span className="text-xs" style={{ color: `${textColor}55`, fontFamily: bodyFont || undefined }}>
              {subtitle}
            </span>
          )}
          {props?.showTrend && trend && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  trend === "up" ? "#22c55e12" : trend === "down" ? "#ef444412" : `${textColor}08`,
                color:
                  trend === "up" ? "#16a34a" : trend === "down" ? "#dc2626" : `${textColor}55`,
              }}
            >
              {trend === "up" ? (
                <ArrowUp size={12} />
              ) : trend === "down" ? (
                <ArrowDown size={12} />
              ) : (
                <Minus size={12} />
              )}
              <span>{String(trendDelta ?? "")}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
