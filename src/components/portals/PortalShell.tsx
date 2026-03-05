'use client';

import { ReactNode, createContext, useContext, useState, useCallback } from 'react';

// ── Theme Context ─────────────────────────────────────────────
type PortalTheme = 'light' | 'dark';

interface PortalThemeContextValue {
  theme: PortalTheme;
  toggle: () => void;
}

const PortalThemeContext = createContext<PortalThemeContextValue>({
  theme: 'light',
  toggle: () => {},
});

export function usePortalTheme() {
  return useContext(PortalThemeContext);
}

// ── Theme Toggle Button ───────────────────────────────────────
function ThemeToggle() {
  const { theme, toggle } = usePortalTheme();
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
      style={{
        backgroundColor: theme === 'light' ? '#f1f5f9' : '#1e293b',
        border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#334155'}`,
      }}
    >
      {/* Sun */}
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
      {/* Moon */}
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

// ── Shell Props ───────────────────────────────────────────────
interface PortalShellProps {
  portalName: string;
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  children: ReactNode;
  defaultTheme?: PortalTheme;
}

export function PortalShell({
  portalName,
  tenantName,
  logoUrl,
  primaryColor,
  secondaryColor,
  children,
  defaultTheme = 'dark',
}: PortalShellProps) {
  const [theme, setTheme] = useState<PortalTheme>(defaultTheme);
  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  const isDark = theme === 'dark';

  return (
    <PortalThemeContext.Provider value={{ theme, toggle }}>
      <div
        className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={{
          '--portal-primary': primaryColor,
          '--portal-secondary': secondaryColor,
          backgroundColor: isDark ? '#0c0c14' : '#f8fafc',
          color: isDark ? '#f0f0f5' : '#111827',
        } as React.CSSProperties}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 border-b backdrop-blur-md transition-colors duration-300"
          style={{
            backgroundColor: isDark ? 'rgba(12, 12, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            borderColor: isDark ? '#1e1e2e' : '#e5e7eb',
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={tenantName} className="h-8 w-auto object-contain" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {tenantName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1
                  className="text-sm font-semibold"
                  style={{ color: isDark ? '#f0f0f5' : '#111827' }}
                >
                  {portalName}
                </h1>
                <p
                  className="text-xs"
                  style={{ color: isDark ? '#8b8ba0' : '#6b7280' }}
                >
                  Powered by {tenantName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              {/* Live indicator */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span
                  className="text-xs"
                  style={{ color: isDark ? '#8b8ba0' : '#6b7280' }}
                >
                  Live
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer
          className="border-t py-4 text-center transition-colors duration-300"
          style={{
            backgroundColor: isDark ? 'rgba(12, 12, 20, 0.5)' : 'rgba(255, 255, 255, 0.5)',
            borderColor: isDark ? '#1e1e2e' : '#e5e7eb',
          }}
        >
          <p className="text-xs" style={{ color: isDark ? '#4a4a5e' : '#9ca3af' }}>
            © {new Date().getFullYear()} {tenantName}. All rights reserved.
          </p>
        </footer>
      </div>
    </PortalThemeContext.Provider>
  );
}
