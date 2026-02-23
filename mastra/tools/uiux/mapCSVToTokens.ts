// mastra/tools/uiux/mapCSVToTokens.ts
//
// Deterministic mapping from CSV row data to canonical design token schema.
// Derives missing semantic colors algorithmically from base palette.
//
export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  text: string;
}
export interface FontTokens {
  heading: string;
  body: string;
  googleFontsUrl?: string;
  cssImport?: string;
}
export interface DesignTokens {
  colors: ColorTokens;
  fonts: FontTokens;
  spacing: { unit: number };
  radius: number;
  shadow: string;
  style: {
    name: string;
    type: string;
    keywords: string;
    effects: string;
  };
}
/**
 * Determine if a hex color represents a dark background.
 * Uses relative luminance formula (WCAG 2.0).
 * Returns true if luminance < 0.2 (dark enough for white text).
 */
export function isDarkBackground(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  // sRGB to linear
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.2;
}
/**
 * Derive semantic colors (success, warning, error) algorithmically.
 * Uses context-aware defaults based on whether background is dark or light.
 */
export function deriveSemanticColors(background: string): {
  success: string;
  warning: string;
  error: string;
} {
  const dark = isDarkBackground(background);
  return {
    success: dark ? '#34D399' : '#10B981', // emerald-400 / emerald-500
    warning: dark ? '#FBBF24' : '#F59E0B', // amber-400 / amber-500
    error: dark ? '#F87171' : '#EF4444',   // red-400 / red-500
  };
}
/**
 * Lighten a hex color by a factor (0-1). Factor 0.2 = 20% lighter.
 */
function lightenHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.min(255, Math.round(parseInt(clean.substring(0, 2), 16) + (255 - parseInt(clean.substring(0, 2), 16)) * factor));
  const g = Math.min(255, Math.round(parseInt(clean.substring(2, 4), 16) + (255 - parseInt(clean.substring(2, 4), 16)) * factor));
  const b = Math.min(255, Math.round(parseInt(clean.substring(4, 6), 16) + (255 - parseInt(clean.substring(4, 6), 16)) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Shift hue of a hex color by degrees (0-360).
 */
function shiftHueHex(hex: string, degrees: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  let r = parseInt(clean.substring(0, 2), 16) / 255;
  let g = parseInt(clean.substring(2, 4), 16) / 255;
  let b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = ((h * 360 + degrees) % 360) / 360;
  if (h < 0) h += 1;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Map color CSV row_data (from getColorRecommendations) to ColorTokens.
 */
export function mapColorCSVToTokens(colorRow: Record<string, string>): ColorTokens {
  // CSV headers from colors.csv: "Primary (Hex)", "Secondary (Hex)", "CTA (Hex)", "Background (Hex)", "Text (Hex)"
  // Also handle lowercase keys from getColorRecommendations output and other tools
  const primary = colorRow['Primary (Hex)'] || colorRow.primary || colorRow['Primary'] || '#3B82F6';

  let secondary = colorRow['Secondary (Hex)'] || colorRow.secondary || colorRow['Secondary'] || '';
  let accent = colorRow['CTA (Hex)'] || colorRow.accent || colorRow['Accent'] || '';

  // BUG 4 FIX: If secondary/accent are empty OR identical to primary, derive distinct colors
  if (!secondary || secondary === primary) {
    secondary = lightenHex(primary, 0.25); // 25% lighter
  }
  if (!accent || accent === primary) {
    accent = shiftHueHex(primary, 30); // Shift hue by 30 degrees
  }
  // Edge case: if secondary ended up same as accent after derivation, shift accent more
  if (secondary === accent) {
    accent = shiftHueHex(primary, 60);
  }

  const mood = (colorRow['Notes'] || colorRow.mood || colorRow['Mood'] || '').toLowerCase();

  // Derive background from mood keywords
  const darkMoods = ['dark', 'night', 'midnight', 'cyber', 'neon', 'deep', 'bold', 'dramatic', 'moody'];
  const isDarkMood = darkMoods.some(d => mood.includes(d));
  const background = colorRow['Background (Hex)'] || colorRow.background || colorRow['Background'] || (isDarkMood ? '#0F172A' : '#F8FAFC');
  const text = colorRow['Text (Hex)'] || colorRow.text || colorRow['Text'] || (isDarkBackground(background) ? '#F1F5F9' : '#0F172A');
  const semantics = deriveSemanticColors(background);
  return {
    primary,
    secondary,
    accent,
    success: colorRow.success || semantics.success,
    warning: colorRow.warning || semantics.warning,
    error: colorRow.error || semantics.error,
    background,
    text,
  };
}
/**
 * Map typography CSV row_data (from getTypographyRecommendations) to FontTokens.
 *
 * CSV columns: headingFont, bodyFont, googleFontsUrl, cssImport, tailwindConfig
 * Token schema: fonts.heading, fonts.body, fonts.googleFontsUrl, fonts.cssImport
 */
export function mapTypographyCSVToTokens(typoRow: Record<string, string>): FontTokens {
  return {
    heading: (typoRow.headingFont || typoRow['Heading Font'] || 'Inter') + ', sans-serif',
    body: (typoRow.bodyFont || typoRow['Body Font'] || 'Inter') + ', sans-serif',
    googleFontsUrl: typoRow.googleFontsUrl || typoRow['Google Fonts URL'] || undefined,
    cssImport: typoRow.cssImport || typoRow['CSS Import'] || undefined,
  };
}
/**
 * Build a complete DesignTokens object from color + typography + style CSV data.
 */
export function buildDesignTokens(params: {
  colorRow: Record<string, string>;
  typographyRow: Record<string, string>;
  styleRow?: Record<string, string>;
  customName?: string;
}): DesignTokens {
  const colors = mapColorCSVToTokens(params.colorRow);
  const fonts = mapTypographyCSVToTokens(params.typographyRow);
  const styleRow = params.styleRow || {};
  const styleName = params.customName
    || styleRow['Style Category']
    || styleRow.styleCategory
    || 'Custom Design';
  // Derive shadow from background darkness
  const dark = isDarkBackground(colors.background);
  return {
    colors,
    fonts,
    spacing: { unit: 8 },
    radius: 8,
    shadow: dark ? 'glow' : 'soft',
    style: {
      name: styleName,
      type: styleRow['Type'] || styleRow.type || (dark ? 'Dark' : 'Light'),
      keywords: styleRow['Keywords'] || styleRow.keywords || '',
      effects: styleRow['Effects & Animation'] || styleRow.effects || '',
    },
  };
}
