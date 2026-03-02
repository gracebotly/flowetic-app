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
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span
          className={`text-sm font-semibold ${
            isAtLimit
              ? "text-red-600"
              : isNearLimit
                ? "text-amber-600"
                : "text-gray-900"
          }`}
        >
          {current} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
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
