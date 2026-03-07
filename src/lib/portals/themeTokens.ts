export type PortalTheme = 'light' | 'dark';

export interface ThemeTokens {
  bgPage: string;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  bgExpanded: string;
  bgCode: string;
  borderCode: string;
  headerBg: string;
  headerBorder: string;
  footerBg: string;
}

const LIGHT_TOKENS: ThemeTokens = {
  bgPage: '#f8fafc',
  bgCard: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  bgExpanded: '#f8fafc',
  bgCode: '#f1f5f9',
  borderCode: '#e2e8f0',
  headerBg: 'rgba(255,255,255,0.85)',
  headerBorder: '#e5e7eb',
  footerBg: 'rgba(255,255,255,0.5)',
};

const DARK_TOKENS: ThemeTokens = {
  bgPage: '#0c0c14',
  bgCard: '#12121c',
  border: '#1e1e30',
  textPrimary: '#f0f0f5',
  textSecondary: '#8b8ba0',
  textMuted: '#4a4a5e',
  bgExpanded: '#16162a',
  bgCode: '#0c0c14',
  borderCode: '#1e1e30',
  headerBg: 'rgba(12,12,20,0.85)',
  headerBorder: '#1e1e2e',
  footerBg: 'rgba(12,12,20,0.5)',
};

export function getThemeTokens(theme: PortalTheme): ThemeTokens {
  return theme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
}

// Status colors — universal, never change, never replaced by accent
export const STATUS = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
} as const;

// Default accent when agency hasn't set primary_color
export const DEFAULT_ACCENT = '#3b82f6';
