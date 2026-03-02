"use client";

interface StatusDotProps {
  color: string; // "emerald" | "amber" | "red" | "blue" | "gray"
  size?: "sm" | "md";
}

const DOT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  gray: "bg-gray-400",
};

const RING_COLORS: Record<string, string> = {
  emerald: "bg-emerald-100",
  amber: "bg-amber-100",
  red: "bg-red-100",
  blue: "bg-blue-100",
  gray: "bg-gray-200",
};

export function StatusDot({ color, size = "md" }: StatusDotProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const ringSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div
      className={`flex items-center justify-center rounded-full ${ringSize} ${RING_COLORS[color] ?? RING_COLORS.gray}`}
    >
      <div className={`rounded-full ${dotSize} ${DOT_COLORS[color] ?? DOT_COLORS.gray}`} />
    </div>
  );
}
