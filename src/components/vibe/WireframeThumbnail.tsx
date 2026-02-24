'use client';

import React from 'react';
import type { WireframeComponent } from '@/types/proposal';

interface WireframeThumbnailProps {
  components: WireframeComponent[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text?: string;
  };
  className?: string;
}

/**
 * Parametric SVG wireframe renderer.
 * Takes WireframeComponent[] + colors and renders a mini visual preview.
 * No text labels — purely spatial with color-coded shapes.
 */
export function WireframeThumbnail({ components, colors, className = '' }: WireframeThumbnailProps) {
  const gridCols = 12;
  const gridRows = Math.max(5, ...components.map(c => c.layout.row + c.layout.h));
  const cellW = 100 / gridCols;
  const cellH = 100 / gridRows;
  const gap = 1.2; // percentage gap

  function getComponentColor(type: WireframeComponent['type']): string {
    switch (type) {
      case 'kpi':
        return colors.primary;
      case 'line_chart':
      case 'bar_chart':
        return colors.secondary;
      case 'pie_chart':
        return colors.accent;
      case 'table':
        return `${colors.primary}40`; // 25% opacity
      case 'funnel':
        return colors.accent;
      case 'timeline':
        return colors.secondary;
      case 'status_grid':
        return `${colors.secondary}60`;
      default:
        return colors.primary;
    }
  }

  function renderComponent(comp: WireframeComponent) {
    const x = comp.layout.col * cellW + gap;
    const y = comp.layout.row * cellH + gap;
    const w = comp.layout.w * cellW - gap * 2;
    const h = comp.layout.h * cellH - gap * 2;
    const color = getComponentColor(comp.type);
    const rx = 2;

    switch (comp.type) {
      case 'kpi':
        return (
          <g key={comp.id}>
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} rx={rx} fill={color} opacity={0.15} />
            <rect x={`${x + w * 0.1}%`} y={`${y + h * 0.25}%`} width={`${w * 0.5}%`} height={`${h * 0.2}%`} rx={1} fill={color} opacity={0.6} />
            <rect x={`${x + w * 0.1}%`} y={`${y + h * 0.55}%`} width={`${w * 0.3}%`} height={`${h * 0.15}%`} rx={1} fill={color} opacity={0.3} />
          </g>
        );
      case 'line_chart':
        return (
          <g key={comp.id}>
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} rx={rx} fill={color} opacity={0.08} />
            <polyline
              points={`${x + w * 0.05},${y + h * 0.7} ${x + w * 0.25},${y + h * 0.4} ${x + w * 0.45},${y + h * 0.55} ${x + w * 0.65},${y + h * 0.25} ${x + w * 0.85},${y + h * 0.35} ${x + w * 0.95},${y + h * 0.15}`
                .split(' ').map(p => {
                  const [px, py] = p.split(',');
                  return `${parseFloat(px)}%,${parseFloat(py)}%`;
                }).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              opacity={0.7}
            />
          </g>
        );
      case 'bar_chart':
        const barCount = 5;
        const barGap = w * 0.04;
        const barW = (w - barGap * (barCount + 1)) / barCount;
        return (
          <g key={comp.id}>
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} rx={rx} fill={color} opacity={0.08} />
            {Array.from({ length: barCount }).map((_, i) => {
              const barH = h * (0.3 + Math.random() * 0.5);
              return (
                <rect
                  key={i}
                  x={`${x + barGap + i * (barW + barGap)}%`}
                  y={`${y + h - barH - h * 0.1}%`}
                  width={`${barW}%`}
                  height={`${barH}%`}
                  rx={1}
                  fill={color}
                  opacity={0.5}
                />
              );
            })}
          </g>
        );
      case 'pie_chart':
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.min(w, h) * 0.35;
        return (
          <g key={comp.id}>
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} rx={rx} fill={color} opacity={0.08} />
            <circle cx={`${cx}%`} cy={`${cy}%`} r={`${r}%`} fill={color} opacity={0.4} />
            <circle cx={`${cx}%`} cy={`${cy}%`} r={`${r * 0.5}%`} fill={colors.background} />
          </g>
        );
      case 'table':
        const rowCount = 4;
        const rowH = h / (rowCount + 1);
        return (
          <g key={comp.id}>
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} rx={rx} fill={color} opacity={0.06} />
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${rowH}%`} rx={rx} fill={color} opacity={0.15} />
            {Array.from({ length: rowCount }).map((_, i) => (
              <line
                key={i}
                x1={`${x + w * 0.05}%`} y1={`${y + (i + 1) * rowH}%`}
                x2={`${x + w * 0.95}%`} y2={`${y + (i + 1) * rowH}%`}
                stroke={color}
                strokeWidth="0.5"
                opacity={0.2}
              />
            ))}
          </g>
        );
      default:
        return (
          <g key={comp.id}>
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} rx={rx} fill={color} opacity={0.12} />
          </g>
        );
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full ${className}`}
      style={{ background: colors.background }}
    >
      {components.map(renderComponent)}
    </svg>
  );
}
