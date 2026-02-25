'use client';

import React from 'react';
import { Plus, Database, BarChart3, PieChart, Table, Activity } from 'lucide-react';
import type { RendererProps } from '../componentRegistry';

/**
 * EmptyStateCard — CTA card rendered when a skeleton slot has no data.
 *
 * Instead of a dead "No data yet" placeholder, this shows a contextual
 * call-to-action that guides the user to connect data. Styled with
 * design tokens so it matches the dashboard theme.
 */
export function EmptyStateCard({ component, designTokens, deviceMode }: RendererProps) {
  const props = component.props || {};
  const sectionId = (props.sectionId as string) || '';
  const iconName = (props.icon as string) || 'database';

  // Contextual CTA text based on what section is empty
  const { title, subtitle, actionLabel } = getCTACopy(sectionId);

  const primary = designTokens?.colors?.primary || '#6366F1';
  const surfaceColor = designTokens?.colors?.surface || '#F8FAFC';
  const textColor = designTokens?.colors?.text || '#1E293B';
  const mutedColor = designTokens?.colors?.muted || '#94A3B8';
  const borderRadius = designTokens?.borderRadius ?? 12;
  const headingFont = designTokens?.fonts?.heading || 'inherit';
  const bodyFont = designTokens?.fonts?.body || 'inherit';

  const isMobile = deviceMode === 'mobile';
  const IconComponent = ICON_MAP[iconName] || Database;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMobile ? 10 : 14,
        padding: isMobile ? 16 : 28,
        minHeight: isMobile ? 80 : 120,
        height: '100%',
        background: `linear-gradient(135deg, ${surfaceColor}, ${primary}06)`,
        border: `1px solid ${primary}18`,
        borderRadius,
        textAlign: 'center',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: isMobile ? 36 : 44,
          height: isMobile ? 36 : 44,
          borderRadius: '50%',
          background: `${primary}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconComponent size={isMobile ? 16 : 20} color={primary} strokeWidth={1.5} />
      </div>

      {/* Title */}
      <p
        style={{
          margin: 0,
          fontSize: isMobile ? 12 : 14,
          fontWeight: 600,
          color: textColor,
          fontFamily: headingFont,
        }}
      >
        {title}
      </p>

      {/* Subtitle */}
      <p
        style={{
          margin: 0,
          fontSize: isMobile ? 10 : 12,
          color: mutedColor,
          fontFamily: bodyFont,
          maxWidth: 260,
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </p>

      {/* CTA Button */}
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: isMobile ? '6px 12px' : '8px 16px',
          fontSize: isMobile ? 11 : 12,
          fontWeight: 600,
          fontFamily: bodyFont,
          color: '#ffffff',
          background: `linear-gradient(135deg, ${primary}, ${primary}dd)`,
          border: 'none',
          borderRadius: Math.max(6, (borderRadius as number) - 4),
          cursor: 'pointer',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        onClick={() => {
          // In preview mode this is non-functional — but in the future
          // this can trigger the data source connection flow
          console.log(`[CTA] Add data source clicked for section: ${sectionId}`);
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
        {actionLabel}
      </button>
    </div>
  );
}

// ── Icon map ──
const ICON_MAP: Record<string, typeof Database> = {
  'bar-chart-2': BarChart3,
  'bar-chart': BarChart3,
  'pie-chart': PieChart,
  activity: Activity,
  database: Database,
  table: Table,
  inbox: Database,
};

// ── Contextual CTA copy based on section type ──
function getCTACopy(sectionId: string): { title: string; subtitle: string; actionLabel: string } {
  const lower = sectionId.toLowerCase();

  if (lower.includes('chart') || lower.includes('trend') || lower.includes('breakdown')) {
    return {
      title: 'Chart section ready',
      subtitle: 'Connect a data source to visualize trends and breakdowns here.',
      actionLabel: 'Add chart data',
    };
  }
  if (lower.includes('table') || lower.includes('feed') || lower.includes('activity')) {
    return {
      title: 'Table section ready',
      subtitle: 'Link event data to populate this table with live records.',
      actionLabel: 'Connect events',
    };
  }
  if (lower.includes('kpi') || lower.includes('metric') || lower.includes('hero')) {
    return {
      title: 'Metrics ready',
      subtitle: 'Add a data source to surface key performance indicators.',
      actionLabel: 'Add metrics',
    };
  }

  // Generic fallback
  return {
    title: 'Section ready',
    subtitle: 'This section will come alive once you connect a data source.',
    actionLabel: 'Add data source',
  };
}

export default EmptyStateCard;
