"use client";

import { Link2, CreditCard } from "lucide-react";
import { OfferingCard } from "./OfferingCard";

type AccessType = "magic_link" | "stripe_gate";
type PricingType = "free" | "per_run" | "monthly" | "usage_based";

type Props = {
  accessType: AccessType;
  pricingType: PricingType;
  priceCents: number;
  onSelect: (accessType: AccessType) => void;
  onPricingChange: (pricingType: PricingType, priceCents: number) => void;
};

const ACCESS_OPTIONS: Array<{
  value: AccessType;
  title: string;
  description: string;
  icon: typeof Link2;
  color: string;
}> = [
  {
    value: "magic_link",
    title: "Free Magic Link",
    description:
      "Generate a unique link. Anyone with the link can access the offering. No login required. Best for client retention — share results, prove ROI.",
    icon: Link2,
    color: "sky",
  },
  {
    value: "stripe_gate",
    title: "Payment Gate",
    description:
      "Clients pay before they can access. Supports per-run, monthly, and usage-based pricing. Requires Stripe Connect (set up in Settings).",
    icon: CreditCard,
    color: "amber",
  },
];

const PRICING_MODELS: Array<{ value: PricingType; label: string; hint: string }> = [
  { value: "free", label: "Free", hint: "No charge — for demos or included clients" },
  { value: "per_run", label: "Per Run", hint: "Charge each time the workflow executes" },
  { value: "monthly", label: "Monthly", hint: "Flat monthly subscription fee" },
  { value: "usage_based", label: "Usage Based", hint: "Variable pricing by usage" },
];

export function WizardStepAccess({
  accessType,
  pricingType,
  priceCents,
  onSelect,
  onPricingChange,
}: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        How should your client access this?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose between a free shareable link or a paid product gate.
      </p>

      <div className="mt-6 grid gap-4">
        {ACCESS_OPTIONS.map((option) => (
          <OfferingCard
            key={option.value}
            title={option.title}
            description={option.description}
            icon={option.icon}
            color={option.color}
            selected={accessType === option.value}
            onClick={() => onSelect(option.value)}
          />
        ))}
      </div>

      {/* Pricing options — only shown when stripe_gate is selected */}
      {accessType === "stripe_gate" && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h3 className="text-sm font-semibold text-gray-900">Pricing Model</h3>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {PRICING_MODELS.map((model) => (
              <button
                key={model.value}
                type="button"
                onClick={() => onPricingChange(model.value, priceCents)}
                className={`rounded-lg border px-3 py-2.5 text-left transition ${
                  pricingType === model.value
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className="block text-sm font-medium text-gray-900">
                  {model.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-500">
                  {model.hint}
                </span>
              </button>
            ))}
          </div>

          {/* Price input — hidden for free */}
          {pricingType !== "free" && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600">
                Price (USD)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceCents > 0 ? (priceCents / 100).toFixed(2) : ""}
                  onChange={(e) => {
                    const dollars = parseFloat(e.target.value) || 0;
                    onPricingChange(pricingType, Math.round(dollars * 100));
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-4 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
