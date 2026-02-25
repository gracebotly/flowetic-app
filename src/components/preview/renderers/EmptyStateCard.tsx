'use client';

import React from 'react';
import type { RendererProps } from '../componentRegistry';

/**
 * EmptyStateCard — rendered when a skeleton slot can't be filled by available data.
 *
 * Designed to look intentional, not broken. Uses the design token accent color
 * and a contextual icon + message. This is what makes premium tools feel
 * polished even with sparse data — Vercel, Linear, and Stripe all do this.
 *
 * Supported across ALL 11 skeleton categories (dashboard, product, admin).
 */
export function EmptyStateCard({ component, designTokens, deviceMode }: RendererProps) {
  const props = component.props || {};
  const title = (props.title as string) || 'No data yet';
  const subtitle = (props.subtitle as string) || 'Connect more events to populate this section';
  const iconName = (props.icon as string) || 'inbox';

  const accentColor = designTokens?.colors?.accent || designTokens?.colors?.primary || '#6366F1';
  const surfaceColor = designTokens?.colors?.surface || '#F8FAFC';
  const mutedColor = designTokens?.colors?.muted || '#94A3B8';
  const borderRadius = designTokens?.borderRadius ?? 12;

  const isMobile = deviceMode === 'mobile';

  // Simple icon map — covers the common section types
  const iconSvg = getIconSvg(iconName, accentColor);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMobile ? 8 : 12,
        padding: isMobile ? 16 : 24,
        minHeight: isMobile ? 80 : 120,
        height: '100%',
        background: surfaceColor,
        border: `1px dashed ${mutedColor}40`,
        borderRadius,
        textAlign: 'center',
      }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: isMobile ? 40 : 56,
          height: isMobile ? 40 : 56,
          borderRadius: '50%',
          background: `${accentColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        dangerouslySetInnerHTML={{ __html: iconSvg }}
      />

      {/* Title */}
      <p
        style={{
          margin: 0,
          fontSize: isMobile ? 13 : 15,
          fontWeight: 600,
          color: designTokens?.colors?.text || '#1E293B',
          fontFamily: designTokens?.fonts?.heading || 'inherit',
        }}
      >
        {title}
      </p>

      {/* Subtitle */}
      <p
        style={{
          margin: 0,
          fontSize: isMobile ? 11 : 13,
          color: mutedColor,
          fontFamily: designTokens?.fonts?.body || 'inherit',
          maxWidth: 280,
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function getIconSvg(name: string, color: string): string {
  const size = 24;
  const stroke = color;
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;

  switch (name) {
    case 'bar-chart-2':
      return `<svg ${common}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
    case 'pie-chart':
      return `<svg ${common}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`;
    case 'activity':
      return `<svg ${common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    case 'inbox':
      return `<svg ${common}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`;
    case 'trending-up':
      return `<svg ${common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
    case 'table':
      return `<svg ${common}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>`;
    default:
      return `<svg ${common}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`;
  }
}

export default EmptyStateCard;
