"use client";

import { Eye, Loader2, FileText, AlertCircle } from "lucide-react";

type InputField = {
  name: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
};

type Props = {
  surfaceType: string;
  platform: string | null;
  entityName: string;
  entityUuid: string | null;
  // For product surface types, auto-fetched input schema
  inputSchema: InputField[];
  onSchemaLoaded: (fields: InputField[]) => void;
  schemaLoading: boolean;
};

export function WizardStepPreview({
  surfaceType,
  platform,
  entityName,
  entityUuid,
  inputSchema,
  onSchemaLoaded,
  schemaLoading,
}: Props) {
  void entityUuid;
  void onSchemaLoaded;

  const isProduct = surfaceType === "runner" || surfaceType === "both";
  const isAnalytics = surfaceType === "analytics" || surfaceType === "both";

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        {isProduct ? "Preview & configure" : "Preview your portal"}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {isProduct
          ? "Review the auto-detected form fields your client's customers will fill out."
          : (platform === "vapi" || platform === "retell")
            ? "Your client will see a branded voice analytics dashboard with call metrics, sentiment, and trends."
            : "Your client will see a branded workflow dashboard with execution metrics and performance trends."}
      </p>

      {/* Analytics preview section */}
      {isAnalytics && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Analytics Dashboard</h3>
              <p className="text-xs text-gray-500">
                {(platform === "vapi" || platform === "retell")
                  ? "Call volume, success rates, sentiment analysis, and duration trends for "
                  : "Execution counts, success rates, error alerts, and runtime trends for "}
                <span className="font-medium text-gray-700">{entityName || "your entity"}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {((platform === "vapi" || platform === "retell")
              ? ["Total Calls", "Success Rate", "Avg Duration"]
              : ["Executions", "Success Rate", "Avg Runtime"]
            ).map((label) => (
              <div
                key={label}
                className="rounded-lg border border-gray-100 bg-white p-3 text-center"
              >
                <div className="text-lg font-bold text-gray-300">—</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            Live data will populate once this portal is created and your client opens it.
          </p>
        </div>
      )}

      {/* Product form preview section */}
      {isProduct && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Product Form Fields</h3>
              <p className="text-xs text-gray-500">
                Auto-detected from your {platform || "workflow"} configuration
              </p>
            </div>
          </div>

          {schemaLoading ? (
            <div className="mt-4 flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Analyzing workflow inputs…</span>
            </div>
          ) : inputSchema.length > 0 ? (
            <div className="mt-4 space-y-2">
              {inputSchema.map((field, i) => (
                <div
                  key={field.name}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-2.5"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-500">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{field.label}</span>
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                      {field.type}
                    </span>
                  </div>
                  {field.required && (
                    <span className="text-[10px] font-medium text-red-400">Required</span>
                  )}
                </div>
              ))}
              <p className="mt-2 text-[11px] text-gray-400">
                You can customize these fields after creation.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  No input fields detected
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  Default fields (input text + email) will be used. You can customize after creation.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
