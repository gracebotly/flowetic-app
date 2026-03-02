"use client";

interface BrandingPreviewProps {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string;
  brandFooter: string;
}

export function BrandingPreview({
  logoUrl,
  primaryColor,
  secondaryColor,
  welcomeMessage,
  brandFooter,
}: BrandingPreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ backgroundColor: primaryColor }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-7 w-7 rounded object-contain bg-white/20"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded bg-white/20 text-xs font-bold text-white">
            A
          </div>
        )}
        <span className="text-sm font-semibold text-white">
          {welcomeMessage || "Welcome to your dashboard"}
        </span>
      </div>

      {/* Mock KPI cards */}
      <div className="grid grid-cols-3 gap-3 p-5">
        {["Total Calls", "Success Rate", "Avg Duration"].map((label) => (
          <div
            key={label}
            className="rounded-lg border border-gray-100 bg-gray-50 p-3"
          >
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {label === "Total Calls"
                ? "847"
                : label === "Success Rate"
                  ? "92.3%"
                  : "3m 24s"}
            </p>
          </div>
        ))}
      </div>

      {/* Secondary accent divider */}
      <div className="h-1 w-full" style={{ backgroundColor: secondaryColor }} />

      {/* Footer */}
      <div className="px-5 py-3 text-center">
        <p className="text-xs text-gray-400">
          {brandFooter || "Powered by Your Agency"}
        </p>
      </div>
    </div>
  );
}
