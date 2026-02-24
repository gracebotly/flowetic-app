// src/lib/color-utils.ts
// ============================================================================
// Color utilities for the proposal card system.
// Provides WCAG-compliant contrast text selection for any background color.
// ============================================================================

/**
 * Parse a hex color string to RGB values.
 * Supports #RGB and #RRGGBB formats.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.substring(0, 2), 16),
      g: parseInt(cleaned.substring(2, 4), 16),
      b: parseInt(cleaned.substring(4, 6), 16),
    };
  }
  return null;
}

/**
 * Calculate relative luminance per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Returns '#FFFFFF' or '#000000' depending on which has better
 * WCAG contrast against the given background hex color.
 *
 * Falls back to '#000000' if the hex is unparseable.
 *
 * @param backgroundHex - CSS hex color (e.g. '#1A2B3C' or '#abc')
 * @returns '#FFFFFF' for dark backgrounds, '#000000' for light backgrounds
 */
export function getContrastText(backgroundHex: string): string {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return '#000000';
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  // WCAG threshold: luminance > 0.179 means the background is "light"
  return lum > 0.179 ? '#000000' : '#FFFFFF';
}

/**
 * Lighten or darken a hex color by a percentage.
 * Positive = lighter, negative = darker.
 *
 * @param hex - CSS hex color
 * @param percent - -100 to 100 (negative = darker, positive = lighter)
 */
export function adjustColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const adjust = (c: number) => Math.min(255, Math.max(0, Math.round(c + (percent / 100) * 255)));
  const r = adjust(rgb.r).toString(16).padStart(2, '0');
  const g = adjust(rgb.g).toString(16).padStart(2, '0');
  const b = adjust(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}
