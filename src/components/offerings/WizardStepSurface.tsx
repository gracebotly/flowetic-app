"use client";

import { BarChart3, Play, Layers } from "lucide-react";
import { OfferingCard } from "./OfferingCard";

type SurfaceType = "analytics" | "runner" | "both";

type Props = {
  surfaceType: SurfaceType;
  platform: string | null;
  onSelect: (surfaceType: SurfaceType) => void;
};

const SURFACE_OPTIONS: Array<{
  value: SurfaceType;
  title: string;
  description: string;
  icon: typeof BarChart3;
  color: string;
}> = [
  {
    value: "analytics",
    title: "Live Analytics Dashboard",
    description:
      "Your client sees a branded dashboard with real-time KPIs, charts, and activity tables. Perfect for proving ROI and retaining clients.",
    icon: BarChart3,
    color: "blue",
  },
  {
    value: "runner",
    title: "Workflow Runner",
    description:
      "Your client fills out a form and triggers a workflow. They see results instantly. Great for lead gen, data enrichment, and report generation.",
    icon: Play,
    color: "emerald",
  },
  {
    value: "both",
    title: "Analytics + Workflow Runner",
    description:
      "Full package: your client can view live analytics AND run workflows on demand. The premium offering.",
    icon: Layers,
    color: "violet",
  },
];

export function WizardStepSurface({ surfaceType, platform, onSelect }: Props) {
  // Auto-highlight based on platform
  const platformHint =
    platform === "vapi" || platform === "retell"
      ? "Analytics dashboards work great for voice AI — show your client call volume, success rates, and costs."
      : platform === "n8n" || platform === "make"
        ? "Analytics dashboards are ideal for workflow platforms — show execution counts, success rates, and trends."
        : null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        What should your client see?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose what your client gets when they open the link you share.
      </p>
      {platformHint && (
        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          💡 {platformHint}
        </p>
      )}

      <div className="mt-6 grid gap-4">
        {SURFACE_OPTIONS.map((option) => (
          <OfferingCard
            key={option.value}
            title={option.title}
            description={option.description}
            icon={option.icon}
            color={option.color}
            selected={surfaceType === option.value}
            onClick={() => onSelect(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
