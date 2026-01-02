import React from "react";

export function N8nLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12C5 13.1046 4.10457 14 3 14C1.89543 14 1 13.1046 1 12C1 10.8954 1.89543 10 3 10C4.10457 10 5 10.8954 5 12Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M13 12C13 13.1046 12.1046 14 11 14C9.89543 14 9 13.1046 9 12C9 10.8954 9.89543 10 11 10C12.1046 10 13 10.8954 13 12Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M5 12H9" stroke="currentColor" strokeWidth="2"/>
      <path d="M13 12H17" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

export function MakeLogo({ className }: { className?: string }) {
  // Minimal, monochrome "make" mark; keep professional (no multicolor bars).
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 18V6M8 20V4M12 22V2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 16.5c.9-1.1 1.8-1.6 3-1.6 1.7 0 3 1.2 3 3.1 0 1.8-1.3 3.1-3 3.1-1.2 0-2.1-.5-3-1.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ActivepiecesLogo({ className }: { className?: string }) {
  /**
   * Professionalized Activepieces "A" blob mark (monochrome).
   * Derived from the screenshot silhouette: rounded A-like stroke with two rounded terminals.
   * Kept as a single solid fill to match a business UI.
   */
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.25 17.6c-1.95 0-3.25-1.62-3.25-3.25 0-1.05.55-2.05 1.4-2.65l5.7-4.05c.66-.47 1.44-.73 2.25-.73h.12c1.19 0 2.3.5 3.09 1.38l3.08 3.43c.75.83 1.16 1.9 1.16 2.99 0 1.84-1.48 3.58-3.58 3.58h-1.94c-.77 0-1.5-.32-2.02-.88l-1.08-1.18-1.48 1.05c-.53.38-1.17.58-1.83.58H6.25Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M9.05 14.55 12.4 12.2c.32-.22.76-.17 1.02.12l1.86 2.05c.24.26.22.67-.04.91-.22.2-.55.22-.8.04l-1.5-1.14-2.5 1.76c-.29.21-.69.16-.92-.12-.2-.26-.15-.64.13-.87Z"
        fill="white"
        opacity="0.85"
      />
    </svg>
  );
}

export function VapiLogo({ className }: { className?: string }) {
  // Use the provided SVG but render as monochrome currentColor for a professional look.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.856 9.02c.72-.35 1.55-.05 1.9.67l1.0 2.06 1.01-2.06c.35-.71 1.2-1 1.9-.65.71.35 1 1.2.65 1.9l-2.3 4.69c-.24.49-.74.8-1.28.8-.55 0-1.04-.32-1.28-.81l-2.28-4.7c-.35-.72-.05-1.55.67-1.9Z"
        fill="currentColor"
      />
      <path
        d="M12.45 9.04c.55 0 1.04.32 1.28.81l2.27 4.7c.22.46.2 1-.08 1.44-.27.43-.74.7-1.25.7H10.1c-.51 0-.98-.26-1.25-.7-.27-.44-.3-.98-.07-1.44l2.3-4.7c.24-.49.74-.81 1.28-.81Zm0 4.68-.42.86h.85l-.43-.86Z"
        fill="currentColor"
      />
      <path
        d="M18.98 9.04h1.99c.04 0 .08 0 .12.01l.56.05c.36.03 1.35.19 1.77 1.5.16.51.16 1.08 0 1.59-.42 1.31-1.4 1.47-1.77 1.5l-.56.05c-.04 0-.08 0-.12.01h-.59v1.4c0 .62-.37 1.2-.96 1.39-.97.31-1.86-.42-1.86-1.36V10.8c0-.78.64-1.42 1.42-1.42Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RetellLogo({ className }: { className?: string }) {
  // Use the provided complex SVG as monochrome mark (simplified to currentColor circle+nodes feel).
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.2c2.1 0 3.8 1.7 3.8 3.8S14.1 9.8 12 9.8 8.2 8.1 8.2 6 9.9 2.2 12 2.2Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M17.9 12c2 0 3.6 1.6 3.6 3.6S19.9 19.2 17.9 19.2c-1.4 0-2.7-.8-3.2-2  -.5 1.2-1.8 2-3.2 2s-2.7-.8-3.2-2c-.6 1.2-1.8 2-3.2 2C3.6 19.2 2 17.6 2 15.6S3.6 12 5.6 12c1.4 0 2.7.8 3.2 2 .5-1.2 1.8-2 3.2-2s2.7.8 3.2 2c.6-1.2 1.8-2 3.2-2Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}