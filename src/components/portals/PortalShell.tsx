'use client';

import { ReactNode } from 'react';

interface PortalShellProps {
  portalName: string;
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  children: ReactNode;
}

export function PortalShell({
  portalName,
  tenantName,
  logoUrl,
  primaryColor,
  secondaryColor,
  children,
}: PortalShellProps) {
  return (
    <div
      className="min-h-screen bg-tremor-background-subtle"
      style={{ '--portal-primary': primaryColor, '--portal-secondary': secondaryColor } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm">
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
              <h1 className="text-sm font-semibold text-gray-900">{portalName}</h1>
              <p className="text-xs text-gray-500">Powered by {tenantName}</p>
            </div>
          </div>
          
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-gray-500">Live</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {children}
      </main>

      {/* Footer — no Getflowetic branding */}
      <footer className="border-t bg-white/50 py-4 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} {tenantName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
