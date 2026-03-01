'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeColors {
  bg: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryHover: string;
  success: string;
  error: string;
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  colors: ThemeColors;
}

interface DesignTokens {
  colors?: {
    primary?: string;
    background?: string;
    surface?: string;
    text?: string;
    success?: string;
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ProductThemeProvider');
  return ctx;
}

interface ThemeProviderProps {
  children: ReactNode;
  designTokens?: DesignTokens | null;
  primaryColor?: string;
}

export function ProductThemeProvider({
  children,
  designTokens,
  primaryColor = '#6366f1',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  const tokenColors = designTokens?.colors ?? {};
  const primary = tokenColors.primary ?? primaryColor;

  const colors: ThemeColors =
    theme === 'light'
      ? {
          bg: tokenColors.background ?? '#ffffff',
          surface: tokenColors.surface ?? '#f9fafb',
          surfaceHover: '#f3f4f6',
          text: tokenColors.text ?? '#111827',
          textMuted: '#6b7280',
          border: '#e5e7eb',
          primary,
          primaryHover: `${primary}dd`,
          success: tokenColors.success ?? '#10b981',
          error: '#ef4444',
        }
      : {
          bg: '#0f0f14',
          surface: '#1a1a24',
          surfaceHover: '#24243a',
          text: '#f0f0f5',
          textMuted: '#8b8ba0',
          border: '#2a2a3e',
          primary,
          primaryHover: `${primary}dd`,
          success: '#34d399',
          error: '#f87171',
        };

  return (
    <ThemeContext.Provider value={{ theme, toggle, colors }}>
      <div
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          minHeight: '100vh',
          transition: 'background-color 0.3s ease, color 0.3s ease',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** Sun/Moon toggle button */
export function ThemeToggle() {
  const { theme, toggle, colors } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
      style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="absolute h-4 w-4 transition-all duration-300"
        style={{
          opacity: theme === 'light' ? 1 : 0,
          transform: theme === 'light' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
          color: '#f59e0b',
        }}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="absolute h-4 w-4 transition-all duration-300"
        style={{
          opacity: theme === 'dark' ? 1 : 0,
          transform: theme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)',
          color: '#a78bfa',
        }}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
