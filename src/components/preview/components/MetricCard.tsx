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
import { isColorDark } from "../componentRegistry";


function lightenHex(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = Math.min(255, parseInt(c.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(c.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(c.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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

  // ── Variant-aware styling ──
  const variant = (props?.variant as string) ?? 'default';

  const variantStyles: React.CSSProperties = (() => {
    switch (variant) {
      case 'solid':
        return { ...cardStyle, backgroundColor: `${primary}12`, borderColor: `${primary}25` };
      case 'dark-inset':
        return {
          ...cardStyle,
          backgroundColor: isColorDark(cardStyle.backgroundColor as string || '#fff')
            ? lightenHex(cardStyle.backgroundColor as string || '#1a1a2e', 8) : '#1a1a2e',
          borderColor: 'rgba(255,255,255,0.08)',
        };
      case 'accent-border':
        return { ...cardStyle, borderLeft: `3px solid ${primary}` };
      default:
        return cardStyle;
    }
  })();

  const effectiveTextColor = variant === 'dark-inset' && !isColorDark(dt.colors?.background ?? '#fff')
    ? '#F1F5F9' : textColor;

  return (
    <motion.div
      className={`h-full ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...variantStyles, ...(isHovered ? cardHoverStyle : {}) }}
      data-component-type="MetricCard"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={isEditing ? "button" : undefined}
      tabIndex={isEditing ? 0 : undefined}
      aria-label={isEditing ? `Edit ${title}` : undefined}
      whileTap={isEditing ? { scale: 0.98 } : undefined}
    >
      {variant !== 'accent-border' && (
        <div
          style={{
            height: "3px",
            background: `linear-gradient(90deg, ${primary}, ${accent}cc)`,
            borderRadius: `${dt.borderRadius ?? 8}px ${dt.borderRadius ?? 8}px 0 0`,
          }}
        />
      )}
      <div className="p-4 @[300px]:p-5 flex flex-col justify-between h-[calc(100%-3px)]">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: `${effectiveTextColor}70`, fontFamily: bodyFont || undefined, letterSpacing: "0.05em" }}
          >
            {title}
          </span>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: variant === 'solid'
                ? `linear-gradient(135deg, ${primary}30, ${primary}15)`
                : `linear-gradient(135deg, ${primary}18, ${primary}08)`,
              border: `1px solid ${primary}20`,
            }}
          >
            {React.createElement(icon, { size: 18, color: primary, strokeWidth: 1.8 })}
          </div>
        </div>
        <div className="text-3xl @[300px]:text-4xl font-bold tracking-tight mb-1" style={{ lineHeight: 1.1 }}>
          {hasRealValue ? (
            <AnimatedValue value={value} textColor={effectiveTextColor} font={headingFont} />
          ) : (
            <span style={{ color: `${effectiveTextColor}30`, fontFamily: headingFont || undefined }}>—</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-auto pt-2">
          {subtitle && (
            <span className="text-xs" style={{ color: `${effectiveTextColor}55`, fontFamily: bodyFont || undefined }}>
              {subtitle}
            </span>
          )}
          {trend && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: trend === "up" ? "#22c55e12" : trend === "down" ? "#ef444412" : `${effectiveTextColor}08`,
                color: trend === "up" ? "#16a34a" : trend === "down" ? "#dc2626" : `${effectiveTextColor}55`,
              }}
            >
              {trend === "up" ? <ArrowUp size={12} /> : trend === "down" ? <ArrowDown size={12} /> : <Minus size={12} />}
              <span>{String(trendDelta ?? "")}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
