'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Flex } from '@tremor/react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { getThemeTokens, STATUS } from '@/lib/portals/themeTokens';

// ── Animation ─────────────────────────────────────────────────
export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// ── Hex to RGBA ───────────────────────────────────────────────
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── ThemedCard ────────────────────────────────────────────────
export function ThemedCard({
  children,
  className = '',
  glow = false,
  accentColor,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  accentColor?: string;
}) {
  const { theme } = usePortalTheme();
  const isDark = theme === 'dark';
  const tokens = getThemeTokens(theme);
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ${className}`}
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.border,
        boxShadow:
          glow && accentColor
            ? `0 0 40px ${hexToRgba(accentColor, 0.08)}, 0 1px 3px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`
            : `0 1px 3px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`,
      }}
    >
      {children}
    </div>
  );
}

// ── KPICard ───────────────────────────────────────────────────
// Unified: accepts explicit icon/color OR derives from label.
export function KPICard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  trendValue,
  index,
  tokens: tokensProp,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  index: number;
  tokens?: ReturnType<typeof getThemeTokens>;
}) {
  const { theme } = usePortalTheme();
  const isDark = theme === 'dark';
  const tokens = tokensProp ?? getThemeTokens(theme);
  const iconColor = color ?? STATUS.info;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={index}>
      <ThemedCard>
        <Flex justifyContent="between" alignItems="start">
          <div className="flex-1">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: tokens.textSecondary }}
            >
              {label}
            </p>
            <p
              className="mt-2 text-2xl font-bold tracking-tight"
              style={{ color: tokens.textPrimary }}
            >
              {value}
            </p>
            {trendValue && (
              <p
                className="mt-1 text-xs font-medium"
                style={{
                  color:
                    trend === 'up'
                      ? STATUS.success
                      : trend === 'down'
                        ? STATUS.error
                        : tokens.textMuted,
                }}
              >
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: hexToRgba(iconColor, isDark ? 0.2 : 0.15) }}
            >
              <Icon className="h-5 w-5" style={{ color: iconColor }} />
            </div>
          )}
        </Flex>
      </ThemedCard>
    </motion.div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'success' || status === 'completed';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isSuccess ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-red-400'}`}
      />
      {isSuccess ? 'Success' : 'Failed'}
    </span>
  );
}
