'use client';

import { type CSSProperties, type ElementType, type ReactNode, createContext, useContext, useState, useCallback } from 'react';
import { getThemeTokens } from '@/lib/portals/themeTokens';

// ── Theme Context ─────────────────────────────────────────────
type PortalTheme = 'light' | 'dark';

export interface PortalTab {
  id: string;
  label: string;
  icon: ElementType;
}

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
  const tokens = getThemeTokens(theme);
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
      style={{
        backgroundColor: tokens.bgCode,
        border: `1px solid ${tokens.borderCode}`,
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
  footerText?: string;
  faviconUrl?: string | null;
  tabs?: PortalTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function PortalShell({
  portalName,
  tenantName,
  logoUrl,
  primaryColor,
  secondaryColor,
  children,
  defaultTheme = 'dark',
  footerText,
  faviconUrl,
  tabs,
  activeTab,
  onTabChange,
}: PortalShellProps) {
  const [theme, setTheme] = useState<PortalTheme>(defaultTheme);
  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  const isDark = theme === 'dark';
  const tokens = getThemeTokens(theme);

  return (
    <PortalThemeContext.Provider value={{ theme, toggle }}>
      <div
        className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={{
          '--portal-primary': primaryColor,
          '--portal-secondary': secondaryColor,
          backgroundColor: tokens.bgPage,
          color: tokens.textPrimary,
        } as CSSProperties}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 border-b backdrop-blur-md transition-colors duration-300"
          style={{
            backgroundColor: tokens.headerBg,
            borderColor: tokens.headerBorder,
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={tenantName} className="h-8 w-auto object-contain" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {tenantName ? tenantName.charAt(0).toUpperCase() : "G"}
                </div>
              )}
              <div>
                <h1
                  className="text-sm font-semibold"
                  style={{ color: tokens.textPrimary }}
                >
                  {portalName}
                </h1>
                <p
                  className="text-xs"
                  style={{ color: tokens.textSecondary }}
                >
                  {tenantName || "Getflowetic"}
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
                  style={{ color: tokens.textSecondary }}
                >
                  Live
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        {tabs && tabs.length > 1 && (
          <nav
            className="sticky top-[57px] z-[9] border-b backdrop-blur-md"
            style={{
              backgroundColor: tokens.headerBg,
              borderColor: tokens.border,
            }}
          >
            <div className="mx-auto flex max-w-7xl items-center gap-1 px-3 sm:px-6">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab.id)}
                    className="group relative flex cursor-pointer items-center gap-2 rounded-t-md px-4 py-3 text-sm font-medium transition-colors duration-200"
                    style={{
                      color: isActive ? tokens.textPrimary : tokens.textSecondary,
                    }}
                  >
                    <TabIcon className="h-4 w-4" />
                    {tab.label}
                    {!isActive && (
                      <span
                        className="absolute inset-0 -z-10 rounded-md opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        style={{ backgroundColor: tokens.bgExpanded }}
                      />
                    )}
                    {isActive && (
                      <span
                        className="absolute inset-x-0 bottom-0 h-0.5"
                        style={{ backgroundColor: primaryColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Content */}
        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
          {children}
        </main>

        {/* Footer */}
        <footer
          className="border-t py-4 text-center transition-colors duration-300"
          style={{
            backgroundColor: tokens.footerBg,
            borderColor: tokens.headerBorder,
          }}
        >
          <p className="text-xs" style={{ color: tokens.textMuted }}>
            {footerText || `Powered by ${tenantName || "Getflowetic"}`}
          </p>
        </footer>
      </div>
    </PortalThemeContext.Provider>
  );
}
