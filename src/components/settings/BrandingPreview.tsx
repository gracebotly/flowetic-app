"use client";

interface BrandingPreviewProps {
  tenantName?: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string;
  brandFooter: string;
}

export function BrandingPreview({
  tenantName,
  logoUrl,
  primaryColor,
  secondaryColor,
  welcomeMessage,
  brandFooter,
}: BrandingPreviewProps) {
  const displayName = tenantName || "Getflowetic";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 shadow-sm" style={{ backgroundColor: '#0c0c14' }}>
      {/* Header — matches PortalShell dark theme */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ backgroundColor: 'rgba(12,12,20,0.85)', borderColor: '#1e1e2e' }}
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-7 w-auto max-w-[120px] rounded object-contain"
            />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {initial}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: '#f0f0f5' }}>
              {welcomeMessage || "Welcome to your dashboard"}
            </p>
            <p className="text-xs" style={{ color: '#8b8ba0' }}>
              {displayName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs" style={{ color: '#8b8ba0' }}>Live</span>
        </div>
      </div>

      {/* Gradient accent bar — this is where primary + secondary actually show */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}
      />

      {/* Mock KPI cards — dark theme cards with accent-colored icons */}
      <div className="grid grid-cols-3 gap-3 p-5">
        {[
          { label: "Total Calls", value: "847", iconColor: primaryColor },
          { label: "Success Rate", value: "92.3%", iconColor: "#10b981" },
          { label: "Avg Duration", value: "3m 24s", iconColor: "#f59e0b" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg p-3"
            style={{ backgroundColor: '#12121c', border: '1px solid #1e1e30' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8b8ba0' }}>
                  {item.label}
                </p>
                <p className="mt-1.5 text-lg font-bold" style={{ color: '#f0f0f5' }}>
                  {item.value}
                </p>
              </div>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${item.iconColor}20` }}
              >
                <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.iconColor }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer — matches PortalShell footer */}
      <div
        className="border-t py-3 text-center"
        style={{ backgroundColor: 'rgba(12,12,20,0.5)', borderColor: '#1e1e2e' }}
      >
        <p className="text-xs" style={{ color: '#4a4a5e' }}>
          {brandFooter || `Powered by ${displayName}`}
        </p>
      </div>
    </div>
  );
}
