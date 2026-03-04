"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { WizardStepWorkflow } from "@/components/offerings/WizardStepWorkflow";
import { WizardStepSurface } from "@/components/offerings/WizardStepSurface";
import { WizardStepPreview } from "@/components/offerings/WizardStepPreview";
import { WizardStepConfigure } from "@/components/offerings/WizardStepConfigure";
import { WizardStepSuccess } from "@/components/offerings/WizardStepSuccess";

// ── Types ───────────────────────────────────────────────────

export type SurfaceType = "analytics" | "runner" | "both";
export type AccessType = "magic_link" | "stripe_gate";
export type PricingType = "free" | "per_run" | "monthly" | "usage_based";

export type SourceOption = { id: string; type: string; name: string };
export type EntityOption = {
  entityUuid: string;
  name: string;
  platform: string;
  kind: string;
  externalId: string;
  sourceId: string;
};

type InputField = {
  name: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
};

export type WizardState = {
  selectedSourceId: string | null;
  selectedEntityUuid: string | null;
  selectedPlatform: string | null;
  surfaceType: SurfaceType;
  accessType: AccessType;
  pricingType: PricingType;
  priceCents: number;
  slug: string;
  name: string;
  description: string;
  clientId: string;
  inputSchema: InputField[];
  createdOffering: { id?: string; name?: string } | null;
  magicLink: string | null;
  productUrl: string | null;
};

const INITIAL_STATE: WizardState = {
  selectedSourceId: null,
  selectedEntityUuid: null,
  selectedPlatform: null,
  surfaceType: "analytics",
  accessType: "magic_link",
  pricingType: "free",
  priceCents: 0,
  slug: "",
  name: "",
  description: "",
  clientId: "",
  inputSchema: [],
  createdOffering: null,
  magicLink: null,
  productUrl: null,
};

const STEPS = [
  { number: 1, label: "Select Agent" },
  { number: 2, label: "Choose Type" },
  { number: 3, label: "Preview" },
  { number: 4, label: "Name & Price" },
  { number: 5, label: "Share" },
];

// ── Component ───────────────────────────────────────────────

export default function CreateOfferingPage() {
  const searchParams = useSearchParams();
  const prefilledClientId = searchParams.get("client_id") ?? "";

  const [currentStep, setCurrentStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>({
    ...INITIAL_STATE,
    clientId: prefilledClientId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Data
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const update = useCallback(
    (partial: Partial<WizardState>) =>
      setWizard((prev) => ({ ...prev, ...partial })),
    []
  );

  // ── Load sources + entities + Stripe status on mount ──────
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const { data: membership } = await supabase
          .from("memberships")
          .select("tenant_id")
          .eq("user_id", session.user.id)
          .single();
        if (!membership) return;

        // Sources
        const { data: srcData } = await supabase
          .from("sources")
          .select("id, type, name")
          .eq("tenant_id", membership.tenant_id)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        setSources(
          (srcData ?? []).map((s: { id: string; type: string; name: string | null }) => ({
            id: s.id,
            type: s.type,
            name: s.name || s.type,
          }))
        );

        // Entities
        const res = await fetch("/api/indexed-entities/list");
        const json = await res.json();
        if (json.ok && json.entities) {
          setEntities(
            json.entities.map((e: { entityUuid: string; name: string; platform: string; kind: string; externalId: string; sourceId: string }) => ({
              entityUuid: e.entityUuid,
              name: e.name,
              platform: e.platform,
              kind: e.kind,
              externalId: e.externalId,
              sourceId: e.sourceId,
            }))
          );
        }

        // Stripe status
        const stripeRes = await fetch("/api/stripe/connect/status");
        const stripeJson = await stripeRes.json();
        setStripeConnected(!!stripeJson.charges_enabled);
      } catch (err) {
        console.error("[wizard] Load error:", err);
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, []);

  // ── Auto-fill platform when source changes ────────────────
  useEffect(() => {
    if (wizard.selectedSourceId) {
      const source = sources.find((s) => s.id === wizard.selectedSourceId);
      if (source) update({ selectedPlatform: source.type });
    }
  }, [wizard.selectedSourceId, sources, update]);

  // ── Fetch input schema when entering Step 3 with product type ──
  useEffect(() => {
    if (
      currentStep === 3 &&
      (wizard.surfaceType === "runner" || wizard.surfaceType === "both") &&
      wizard.selectedEntityUuid &&
      wizard.inputSchema.length === 0
    ) {
      setSchemaLoading(true);
      fetch(`/api/entities/${wizard.selectedEntityUuid}/schema`)
        .then((r) => r.json())
        .then((json) => {
          if (json.ok && json.inputSchema) {
            update({ inputSchema: json.inputSchema });
          }
        })
        .catch(() => {})
        .finally(() => setSchemaLoading(false));
    }
  }, [
    currentStep,
    wizard.surfaceType,
    wizard.selectedEntityUuid,
    wizard.inputSchema.length,
    update,
  ]);

  // ── Auto-fill name when source + entity selected ──────────
  useEffect(() => {
    if (wizard.selectedEntityUuid && !wizard.name) {
      const entity = entities.find((e) => e.entityUuid === wizard.selectedEntityUuid);
      if (entity) {
        const suffix =
          wizard.surfaceType === "runner"
            ? ""
            : wizard.surfaceType === "both"
              ? ""
              : " Dashboard";
        update({ name: `${entity.name}${suffix}` });
      }
    }
  }, [wizard.selectedEntityUuid, wizard.surfaceType, wizard.name, entities, update]);

  // ── Step validation ───────────────────────────────────────
  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return !!wizard.selectedSourceId;
      case 2:
        return !!wizard.surfaceType;
      case 3:
        return true; // Preview is informational
      case 4:
        return wizard.name.trim().length >= 3;
      default:
        return false;
    }
  }, [currentStep, wizard]);

  // ── Submit offering ───────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const body: Record<string, unknown> = {
        name: wizard.name.trim(),
        sourceId: wizard.selectedSourceId,
        entityId: wizard.selectedEntityUuid,
        surfaceType: wizard.surfaceType,
        accessType: stripeConnected ? wizard.accessType : "magic_link",
        pricingType:
          stripeConnected && wizard.accessType === "stripe_gate"
            ? wizard.pricingType
            : "free",
        priceCents:
          stripeConnected && wizard.accessType === "stripe_gate"
            ? wizard.priceCents
            : 0,
        clientId: wizard.clientId.trim() || undefined,
        description: wizard.description.trim() || undefined,
      };

      // Add product-specific fields when runner or both
      if (wizard.surfaceType === "runner" || wizard.surfaceType === "both") {
        body.inputSchema = wizard.inputSchema;
        body.executionConfig = {};
      }

      // Add slug for paid products
      if (wizard.accessType === "stripe_gate" && wizard.slug) {
        body.slug = wizard.slug;
      }

      const res = await fetch("/api/offerings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setSubmitError(json.error || "Failed to create portal");
        setSubmitting(false);
        return;
      }

      update({
        createdOffering: json.offering,
        magicLink: json.magicLink || null,
        productUrl: json.productUrl || null,
      });
      setCurrentStep(5);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }, [wizard, submitting, stripeConnected, update]);

  // ── Navigation ────────────────────────────────────────────
  const goBack = () => setCurrentStep((s) => Math.max(1, s - 1));
  const goNext = () => {
    if (currentStep === 4) {
      handleSubmit();
    } else {
      setCurrentStep((s) => Math.min(5, s + 1));
    }
  };

  // ── Batch flow: Create Another (Same Config) ─────────────
  const handleCreateAnother = () => {
    setWizard((prev) => ({
      ...INITIAL_STATE,
      // Preserve agent + type + pricing config
      selectedSourceId: prev.selectedSourceId,
      selectedEntityUuid: prev.selectedEntityUuid,
      selectedPlatform: prev.selectedPlatform,
      surfaceType: prev.surfaceType,
      accessType: prev.accessType,
      pricingType: prev.pricingType,
      priceCents: prev.priceCents,
      slug: "",
      inputSchema: prev.inputSchema,
    }));
    setCurrentStep(4); // Jump to Name & Price — agent + type already chosen
    setSubmitError(null);
  };

  // ── Entity name for preview ───────────────────────────────
  const selectedEntity = entities.find((e) => e.entityUuid === wizard.selectedEntityUuid);
  const entityName = selectedEntity?.name ?? "";

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/control-panel/offerings"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Client Portals
      </Link>

      {/* Title */}
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Create for Client</h1>
      <p className="mt-1 text-sm text-gray-500">
        Deliver a branded dashboard or sellable product to your client in under 60
        seconds.
      </p>

      {/* Progress Stepper — EXACT SAME premium styling */}
      <div className="mt-8 flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isComplete = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          return (
            <div key={step.number} className="flex flex-1 items-center gap-1">
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
                    isCurrent
                      ? "text-blue-600"
                      : isComplete
                        ? "text-gray-600"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mb-5 h-0.5 flex-1 rounded-full transition-all ${
                    isComplete ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content Area */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {dataLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {currentStep === 1 && (
              <WizardStepWorkflow
                sources={sources}
                entities={entities}
                selectedSourceId={wizard.selectedSourceId}
                selectedEntityUuid={wizard.selectedEntityUuid}
                onSelect={(sourceId, entityUuid) =>
                  update({ selectedSourceId: sourceId, selectedEntityUuid: entityUuid })
                }
              />
            )}
            {currentStep === 2 && (
              <WizardStepSurface
                surfaceType={wizard.surfaceType}
                platform={wizard.selectedPlatform}
                onSelect={(surfaceType) => update({ surfaceType })}
              />
            )}
            {currentStep === 3 && (
              <WizardStepPreview
                surfaceType={wizard.surfaceType}
                platform={wizard.selectedPlatform}
                entityName={entityName}
                entityUuid={wizard.selectedEntityUuid}
                inputSchema={wizard.inputSchema}
                onSchemaLoaded={(fields) => update({ inputSchema: fields })}
                schemaLoading={schemaLoading}
              />
            )}
            {currentStep === 4 && (
              <WizardStepConfigure
                name={wizard.name}
                description={wizard.description}
                onChange={(field, value) => update({ [field]: value })}
                clientId={wizard.clientId}
                prefilledClientId={prefilledClientId}
                accessType={wizard.accessType}
                pricingType={wizard.pricingType}
                priceCents={wizard.priceCents}
                slug={wizard.slug}
                onAccessChange={(accessType) => update({ accessType })}
                onPricingChange={(pricingType, priceCents) =>
                  update({ pricingType, priceCents })
                }
                stripeConnected={stripeConnected}
                platform={wizard.selectedPlatform}
                surfaceType={wizard.surfaceType}
                submitError={submitError}
              />
            )}
            {currentStep === 5 && (
              <WizardStepSuccess
                offering={wizard.createdOffering}
                magicLink={wizard.magicLink}
                productUrl={wizard.productUrl}
                accessType={wizard.accessType}
                surfaceType={wizard.surfaceType}
                onCreateAnother={handleCreateAnother}
              />
            )}
          </>
        )}
      </div>

      {/* Navigation Buttons — hidden on Step 5 */}
      {currentStep < 5 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={currentStep === 1}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            onClick={goNext}
            disabled={!canProceed() || submitting}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? "Creating…"
              : currentStep === 4
                ? "Create Portal →"
                : "Continue →"}
          </button>
        </div>
      )}
    </div>
  );
}
