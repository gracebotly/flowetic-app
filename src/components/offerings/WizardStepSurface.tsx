"use client";

import { BarChart3, Play, Layers } from "lucide-react";
import { OfferingCard } from "./OfferingCard";

type SurfaceType = "analytics" | "runner" | "both";

type Props = {
  surfaceType: SurfaceType;
  platform: string | null;
  onSelect: (surfaceType: SurfaceType) => void;
};

type SurfaceOption = {
  value: SurfaceType;
  title: string;
  description: string;
  icon: typeof BarChart3;
  color: string;
};

const VOICE_OPTIONS: SurfaceOption[] = [
  {
    value: "analytics",
    title: "Client Reporting Portal",
    description:
      "Your client gets a branded dashboard showing call volume, success rates, sentiment, and trends. Share via magic link — they see your brand, not Vapi or Retell.",
    icon: BarChart3,
    color: "blue",
  },
];

const WORKFLOW_OPTIONS: SurfaceOption[] = [
  {
    value: "analytics",
    title: "Client Reporting Portal",
    description:
      "Your client gets a branded dashboard showing execution counts, success rates, error alerts, and performance trends. Share via magic link.",
    icon: BarChart3,
    color: "blue",
  },
  {
    value: "runner",
    title: "Workflow Service",
    description:
      "Wrap this automation into a branded product page. Your client's customers fill out a form, the workflow runs, and results display — all under your brand.",
    icon: Play,
    color: "emerald",
  },
  {
    value: "both",
    title: "Portal + Service",
    description:
      "The full package — your client sees the reporting dashboard AND their customers can trigger the workflow through a branded form page.",
    icon: Layers,
    color: "violet",
  },
];

export function WizardStepSurface({ surfaceType, platform, onSelect }: Props) {
  const isVoice = platform === "vapi" || platform === "retell";
  const options = isVoice ? VOICE_OPTIONS : WORKFLOW_OPTIONS;

  const platformHint = isVoice
    ? "Voice agents → your client sees call analytics, sentiment, and transcripts in a branded dashboard."
    : "Workflows → your client sees execution analytics. Service wraps the workflow into a sellable product with a form.";

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
          {platformHint}
        </p>
      )}

      <div className="mt-6 grid gap-4">
        {options.map((option) => (
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
