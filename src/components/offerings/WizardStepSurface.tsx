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
    title: "Analytics Dashboard",
    description:
      "Your client gets a branded dashboard with real-time KPIs, charts, and activity tables. Perfect for proving ROI and keeping clients.",
    icon: BarChart3,
    color: "blue",
  },
  {
    value: "runner",
    title: "SaaS Product",
    description:
      "Wrap your workflow into a sellable product. Your client fills out a form, triggers the workflow, and sees results instantly.",
    icon: Play,
    color: "emerald",
  },
  {
    value: "both",
    title: "Dashboard + Product",
    description:
      "The full package — your client can view live analytics AND run workflows on demand. The premium tier.",
    icon: Layers,
    color: "violet",
  },
];

export function WizardStepSurface({ surfaceType, platform, onSelect }: Props) {
  const platformHint =
    platform === "vapi" || platform === "retell"
      ? "Voice agents → show call volume, success rates, and costs. Products → trigger outbound calls via form."
      : platform === "n8n" || platform === "make"
        ? "Workflows → show execution counts, success rates, and trends. Products → trigger executions via form."
        : null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        What should your client get?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose what your client sees when they open the link you share.
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
