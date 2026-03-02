"use client";

interface HealthBarProps {
  score: number; // 0–100
  showLabel?: boolean;
}

function healthColor(score: number): {
  bg: string;
  fill: string;
  text: string;
} {
  if (score >= 70) return { bg: "bg-emerald-100", fill: "bg-emerald-500", text: "text-emerald-700" };
  if (score >= 40) return { bg: "bg-amber-100", fill: "bg-amber-500", text: "text-amber-700" };
  return { bg: "bg-red-100", fill: "bg-red-500", text: "text-red-700" };
}

export function HealthBar({ score, showLabel = true }: HealthBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const colors = healthColor(clamped);

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 flex-1 rounded-full ${colors.bg}`}>
        <div
          className={`h-2 rounded-full ${colors.fill} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold tabular-nums ${colors.text}`}>
          {clamped}
        </span>
      )}
    </div>
  );
}
