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
 * Map color CSV row_data (from getColorRecommendations) to ColorTokens.
 *
 * CSV columns: paletteName, primary, secondary, accent, mood, useCases
 * Token schema: primary, secondary, accent, success, warning, error, background, text
 *
 * Missing fields are derived:
 * - background: inferred from mood keywords (dark terms → dark bg)
 * - text: inverse of background luminance
 * - success/warning/error: context-aware defaults
 */
export function mapColorCSVToTokens(colorRow: Record<string, string>): ColorTokens {
  const primary = colorRow.primary || colorRow['Primary'] || '#3B82F6';
  const secondary = colorRow.secondary || colorRow['Secondary'] || primary;
  const accent = colorRow.accent || colorRow['Accent'] || primary;
  const mood = (colorRow.mood || colorRow['Mood'] || '').toLowerCase();
  // Derive background from mood keywords
  const darkMoods = ['dark', 'night', 'midnight', 'cyber', 'neon', 'deep', 'bold', 'dramatic', 'moody'];
  const isDarkMood = darkMoods.some(d => mood.includes(d));
  const background = colorRow.background || colorRow['Background'] || (isDarkMood ? '#0F172A' : '#F8FAFC');
  const text = colorRow.text || colorRow['Text'] || (isDarkBackground(background) ? '#F1F5F9' : '#0F172A');
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
