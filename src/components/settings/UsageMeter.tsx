"use client";

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number;
}

export function UsageMeter({ label, current, limit }: UsageMeterProps) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span
          className={`text-xs font-medium ${
            isAtLimit
              ? "text-red-600"
              : isNearLimit
                ? "text-amber-600"
                : "text-slate-900"
          }`}
        >
          {current} / {limit}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isAtLimit
              ? "bg-red-500"
              : isNearLimit
                ? "bg-amber-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
