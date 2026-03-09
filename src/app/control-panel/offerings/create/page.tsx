"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import AgentPicker from "@/components/portals/wizard/AgentPicker";
import type { SelectedEntity, EntityItem } from "@/components/portals/wizard/AgentPicker";
import { WizardStepSurface } from "@/components/offerings/WizardStepSurface";
import PortalPreview from "@/components/portals/wizard/PortalPreview";
import { WizardStepConfigure } from "@/components/offerings/WizardStepConfigure";
import { WizardStepSuccess } from "@/components/offerings/WizardStepSuccess";
import type { InputField } from "@/lib/products/types";

// ── Types ───────────────────────────────────────────────────

export type SurfaceType = "analytics" | "runner" | "both";
export type AccessType = "magic_link" | "stripe_gate";
export type PricingType = "free" | "per_run" | "monthly" | "usage_based";

export type SourceOption = { id: string; type: string; name: string };
function cleanDisplayName(name: string): string {
  return name.replace(/^\d+-/, "").replace(/[_-]/g, " ").trim();
}

type CreatedOffering = { id?: string; name?: string; token?: string | null };

export type WizardState = {
  selectedSourceId: string | null;
  selectedEntityUuid: string | null;
  selectedPlatform: string | null;
  selectedEntities: SelectedEntity[];
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
  createdOfferings: CreatedOffering[];
  creationErrors: { entity: string; error: string }[];
  magicLink: string | null;
  productUrl: string | null;
};

const INITIAL_STATE: WizardState = {
  selectedSourceId: null,
  selectedEntityUuid: null,
  selectedPlatform: null,
  selectedEntities: [],
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
  createdOfferings: [],
  creationErrors: [],
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
  const [userEditedName, setUserEditedName] = useState(false);

  // Data
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [stripeConnected, setStripeConnected] = useState(false);

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
            json.entities.map(
              (e: {
                id?: string;
                entityUuid?: string;
                source_id?: string;
                sourceId?: string;
                display_name?: string;
                name?: string;
                entity_kind?: string;
                kind?: string;
                external_id?: string;
                externalId?: string;
                platform_type?: string;
                platform?: string;
                source_name?: string;
                sourceName?: string;
                last_seen_at?: string | null;
                lastSeenAt?: string | null;
              }) => ({
                id: e.id ?? e.entityUuid ?? "",
                source_id: e.source_id ?? e.sourceId ?? "",
                display_name: e.display_name ?? e.name ?? "",
                entity_kind: e.entity_kind ?? e.kind ?? "",
                external_id: e.external_id ?? e.externalId ?? "",
                platform_type: e.platform_type ?? e.platform ?? "",
                source_name: e.source_name ?? e.sourceName ?? e.platform ?? "Unknown",
                last_seen_at: e.last_seen_at ?? e.lastSeenAt ?? null,
              })
            )
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
      fetch(`/api/entities/${wizard.selectedEntityUuid}/schema`)
        .then((r) => r.json())
        .then((json) => {
          if (json.ok && json.inputSchema) {
            update({ inputSchema: json.inputSchema });
          }
        })
        .catch(() => {});
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
    if (userEditedName) return; // User has manually typed — never overwrite
    if (wizard.selectedEntityUuid) {
      const entity = entities.find((e) => e.id === wizard.selectedEntityUuid);
      if (entity) {
        const suffix =
          wizard.surfaceType === "runner"
            ? ""
            : wizard.surfaceType === "both"
              ? ""
              : " Dashboard";
        update({ name: `${entity.display_name}${suffix}` });
      }
    }
  }, [wizard.selectedEntityUuid, wizard.surfaceType, userEditedName, entities, update]);

  // ── Step validation ───────────────────────────────────────
  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return wizard.selectedEntities.length > 0;
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
      const results: CreatedOffering[] = [];
      const errors: { entity: string; error: string }[] = [];

      for (const entity of wizard.selectedEntities) {
        const portalName =
          wizard.selectedEntities.length === 1
            ? wizard.name.trim()
            : `${wizard.name.trim()} — ${cleanDisplayName(entity.displayName)}`;

        const body: Record<string, unknown> = {
          name: portalName,
          sourceId: entity.sourceId,
          entityId: entity.id,
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

        if (wizard.surfaceType === "runner" || wizard.surfaceType === "both") {
          body.inputSchema = wizard.inputSchema;
          body.executionConfig = {};
        }

        if (wizard.accessType === "stripe_gate" && wizard.slug) {
          body.slug = wizard.slug;
        }

        try {
          const res = await fetch("/api/offerings/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json();

          if (!res.ok || !json.ok) {
            errors.push({
              entity: entity.displayName,
              error: json.error || "Failed to create portal",
            });
          } else {
            results.push({
              ...(json.offering || {}),
              token: json.magicLink ? String(json.magicLink).split("/client/").pop() : null,
            });
          }
        } catch {
          errors.push({ entity: entity.displayName, error: "Network error" });
        }
      }

      if (results.length === 0) {
        setSubmitError(errors[0]?.error || "Failed to create portal");
        return;
      }

      update({
        createdOffering: results[0] || null,
        createdOfferings: results,
        creationErrors: errors,
        magicLink: results.length === 1 && results[0]?.token ? `${window.location.origin}/client/${results[0].token}` : null,
        productUrl: null,
      });
      setCurrentStep(5);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }, [wizard, submitting, stripeConnected, update]);

  // ── Navigation ────────────────────────────────────────────
  const goBack = () => {
    if (currentStep === 3) {
      // If voice agent, skip back to Step 1 (not Step 2)
      const isVoice = wizard.selectedPlatform === 'vapi' || wizard.selectedPlatform === 'retell';
      setCurrentStep(isVoice ? 1 : 2);
    } else {
      setCurrentStep((s) => Math.max(1, s - 1));
    }
  };

  const goNext = () => {
    if (currentStep === 4) {
      handleSubmit();
    } else if (currentStep === 1) {
      // Voice agents only have one option (analytics) — auto-select and skip Step 2
      const isVoice = wizard.selectedPlatform === 'vapi' || wizard.selectedPlatform === 'retell';
      if (isVoice) {
        setWizard((prev) => ({ ...prev, surfaceType: 'analytics' }));
        setCurrentStep(3); // Skip to Preview
      } else {
        setCurrentStep(2);
      }
    } else {
      setCurrentStep((s) => Math.min(5, s + 1));
    }
  };

  // ── Batch flow: Create Another (Same Config) ─────────────
  const handleCreateAnother = () => {
    setUserEditedName(false);
    setWizard((prev) => ({
      ...INITIAL_STATE,
      // Preserve agent + type + pricing config
      selectedSourceId: prev.selectedSourceId,
      selectedEntityUuid: prev.selectedEntityUuid,
      selectedPlatform: prev.selectedPlatform,
      selectedEntities: prev.selectedEntities,
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
              <AgentPicker
                entities={entities}
                loading={dataLoading}
                selected={wizard.selectedEntities}
                onSelectionChange={(selected) => {
                  const uniquePlatforms = [...new Set(selected.map((e) => e.platform))];
                  setWizard((prev) => ({
                    ...prev,
                    selectedEntities: selected,
                    selectedSourceId: selected.length > 0 ? selected[0].sourceId : null,
                    selectedEntityUuid: selected.length > 0 ? selected[0].id : null,
                    selectedPlatform: uniquePlatforms.length > 0 ? uniquePlatforms.join(", ") : null,
                  }));
                }}
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
              <PortalPreview
                platformType={wizard.selectedPlatform || "vapi"}
                sourceId={wizard.selectedSourceId || ""}
                entityName={wizard.selectedEntities?.[0]?.displayName || wizard.name || "Your Portal"}
                surfaceType={wizard.surfaceType}
                inputSchema={wizard.inputSchema}
              />
            )}
            {currentStep === 4 && (
              <>
                <WizardStepConfigure
                  name={wizard.name}
                  description={wizard.description}
                  onChange={(field, value) => {
                    if (field === "name") setUserEditedName(true);
                    update({ [field]: value });
                  }}
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
                {wizard.selectedEntities.length > 1 && (
                  <p className="mt-1 text-xs text-tremor-content dark:text-dark-tremor-content">
                    Each portal will be named: &quot;{wizard.name} — [Agent Name]&quot;
                  </p>
                )}
              </>
            )}
            {currentStep === 5 && (
              <>
                {wizard.createdOfferings.length > 1 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                      {wizard.createdOfferings.length} portals created
                    </h3>
                    {wizard.createdOfferings.map((o, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-tremor-border p-3 dark:border-dark-tremor-border"
                      >
                        <span className="text-sm font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                          {o.name}
                        </span>
                        {o.token && (
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                `${window.location.origin}/client/${o.token}`
                              )
                            }
                            className="cursor-pointer text-xs font-medium text-tremor-brand"
                          >
                            Copy Link
                          </button>
                        )}
                      </div>
                    ))}
                    {wizard.creationErrors.length > 0 && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                          {wizard.creationErrors.length} failed:
                        </p>
                        {wizard.creationErrors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600 dark:text-red-400">
                            {err.entity}: {err.error}
                          </p>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={handleCreateAnother}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      Create Another
                    </button>
                  </div>
                ) : (
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
