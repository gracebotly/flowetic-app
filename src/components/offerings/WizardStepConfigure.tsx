"use client";

type Props = {
  name: string;
  description: string;
  clientId: string;
  platform: string | null;
  surfaceType: string;
  accessType: string;
  onChange: (field: "name" | "description" | "clientId", value: string) => void;
  submitError: string | null;
};

const SURFACE_LABELS: Record<string, string> = {
  analytics: "Live Analytics Dashboard",
  runner: "Workflow Runner",
  both: "Analytics + Workflow Runner",
};

const ACCESS_LABELS: Record<string, string> = {
  magic_link: "Free Magic Link",
  stripe_gate: "Payment Gate",
};

export function WizardStepConfigure({
  name,
  description,
  clientId,
  platform,
  surfaceType,
  accessType,
  onChange,
  submitError,
}: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Name and configure your offering
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Give it a name your client will see, and optionally assign it to a
        specific client.
      </p>

      {/* Summary of prior choices */}
      <div className="mt-5 flex flex-wrap gap-2">
        {platform && (
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 capitalize">
            {platform}
          </span>
        )}
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          {SURFACE_LABELS[surfaceType] ?? surfaceType}
        </span>
        <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
          {ACCESS_LABELS[accessType] ?? accessType}
        </span>
      </div>

      {/* Name input */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">
          Offering Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="e.g. Smith Dental — Voice Agent Dashboard"
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          autoFocus
        />
        <p className="mt-1 text-xs text-gray-400">
          Min 3 characters. Your client will see this name.
        </p>
      </div>

      {/* Description input */}
      <div className="mt-5">
        <label className="block text-sm font-medium text-gray-700">
          Description{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Brief description of what this offering provides…"
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Client assignment */}
      <div className="mt-5">
        <label className="block text-sm font-medium text-gray-700">
          Assign to Client{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => onChange("clientId", e.target.value)}
          placeholder="e.g. Smith Dental, client-001"
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1 text-xs text-gray-400">
          A label to identify which client this offering belongs to.
        </p>
      </div>

      {/* Error */}
      {submitError && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}
    </div>
  );
}
