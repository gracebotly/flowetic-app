import React from "react";

export function N8nLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Circle 1: Bottom-left */}
      <circle cx="5" cy="16" r="3" fill="#EA4B71"/>
      {/* Circle 2: Top-center */}
      <circle cx="12" cy="5" r="3" fill="#EA4B71"/>
      {/* Circle 3: Bottom-right */}
      <circle cx="19" cy="16" r="3" fill="#EA4B71"/>
      {/* Connect C1→C2 */}
      <line x1="5" y1="16" x2="12" y2="5" stroke="#EA4B71" strokeWidth="2"/>
      {/* Connect C1→C3 */}
      <line x1="5" y1="16" x2="19" y2="16" stroke="#EA4B71" strokeWidth="2"/>
    </svg>
  );
}

export function MakeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Bar 1: Shortest */}
      <rect x="2" y="14" width="3" height="6" fill="#A64AC9"/>
      {/* Bar 2: Second */}
      <rect x="6" y="11" width="3" height="9" fill="#8B5CF6"/>
      {/* Bar 3: Third */}
      <rect x="10" y="8" width="3" height="12" fill="#6366F1"/>
      {/* Bar 4: Tallest */}
      <rect x="14" y="5" width="3" height="15" fill="#3B82F6"/>
      {/* Text */}
      <text x="19" y="16" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="bold" fill="#111827">make</text>
    </svg>
  );
}

export function ActivepiecesLogo({ className }: { className?: string }) {
  // Simplified "A" blob with brand colors
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Main A shape */}
      <path
        d="M0 0L4 0L4 2L10 12L16 2L16 0L20 0L12 16L8 16L0 0Z"
        fill="#8B5CF6"
        opacity="0.9"
      />
      {/* Inner detail */}
      <path
        d="M6 3L10 10L14 3"
        stroke="white"
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

export function VapiLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Speech bubble outline */}
      <path
        d="M3 8C3 5.79086 4.79086 4 7 4H17C19.2091 4 21 5.79086 21 8V14C21 16.2091 19.2091 18 17 18H11L7 22V18H7C4.79086 18 3 16.2091 3 14V8Z"
        stroke="#1E293B"
        strokeWidth="2"
        fill="none"
      />
      {/* Soundwave bars - gradient effect */}
      <rect x="6" y="9" width="2" height="6" fill="#0EA5E9" opacity="0.8"/>
      <rect x="9" y="7" width="2" height="8" fill="#3B82F6" opacity="0.8"/>
      <rect x="12" y="10" width="2" height="4" fill="#6366F1" opacity="0.8"/>
      <rect x="15" y="8" width="2" height="6" fill="#8B5CF6" opacity="0.8"/>
    </svg>
  );
}

export function RetellLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Speech bubble outline */}
      <path
        d="M3 8C3 5.79086 4.79086 4 7 4H17C19.2091 4 21 5.79086 21 8V14C21 16.2091 19.2091 18 17 18H11L7 22V18H7C4.79086 18 3 16.2091 3 14V8Z"
        stroke="#1F2937"
        strokeWidth="2"
        fill="none"
      />
      {/* Soundwave bars with gradient */}
      <rect x="6" y="9" width="2" height="6" fill="#3B82F6" opacity="0.8"/>
      <rect x="9" y="7" width="2" height="8" fill="#6366F1" opacity="0.8"/>
      <rect x="12" y="10" width="2" height="4" fill="#8B5CF6" opacity="0.8"/>
      <rect x="15" y="8" width="2" height="6" fill="#9333EA" opacity="0.8"/>
      {/* Text */}
      <text x="12" y="21" fontFamily="Arial, sans-serif" fontSize="3" fontWeight="500" fill="#1F2937" textAnchor="middle">Retell AI</text>
    </svg>
  );
}