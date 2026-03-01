"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Choose Workflow" },
  { number: 2, label: "Client View" },
  { number: 3, label: "Access" },
  { number: 4, label: "Configure" },
  { number: 5, label: "Launch" },
];

export default function CreateOfferingPage() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Back link */}
      <Link href="/control-panel/offerings" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Offerings
      </Link>

      {/* Title */}
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Create an Offering</h1>
      <p className="mt-1 text-sm text-gray-500">Deliver an analytics dashboard or workflow tool to your client in under 60 seconds.</p>

      {/* Progress Stepper */}
      <div className="mt-8 flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isComplete = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <div key={step.number} className="flex flex-1 items-center gap-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isComplete
                      ? "bg-blue-600 text-white"
                      : isCurrent
                        ? "border-2 border-blue-600 bg-white text-blue-600"
                        : "border-2 border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-medium ${
                    isCurrent ? "text-blue-600" : isComplete ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last step) */}
              {i < STEPS.length - 1 && (
                <div className={`mb-5 h-0.5 flex-1 rounded-full transition-all ${isComplete ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content Area */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {/* Placeholder — Phase 4 will replace these with actual WizardStep components */}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-semibold text-gray-900">
            Step {currentStep}: {STEPS[currentStep - 1]?.label}
          </p>
          <p className="mt-2 text-sm text-gray-500">This step will be implemented in Phase 4.</p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
          className="disabled:cursor-not-allowed rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
          disabled={currentStep === 5}
          className="disabled:cursor-not-allowed rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40"
        >
          {currentStep === 4 ? "Create Offering →" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
