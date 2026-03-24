"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trackPortalCreated, trackPortalShared } from "@/lib/analytics/events";

import AgentPicker from "@/components/portals/wizard/AgentPicker";
import type { SelectedEntity, EntityItem } from "@/components/portals/wizard/AgentPicker";
import PortalPreview from "@/components/portals/wizard/PortalPreview";
import { WizardStepConfigure } from "@/components/offerings/WizardStepConfigure";
import { WizardStepSuccess } from "@/components/offerings/WizardStepSuccess";
import type { InputField } from "@/lib/products/types";

// ── Types ───────────────────────────────────────────────────

export type SurfaceType = "analytics" | "runner" | "both";
export type AccessType = "magic_link" | "stripe_gate";
export type PricingType = "free" | "per_run" | "monthly" | "usage_based";

export type SourceOption = { id: string; type: string; name: string };

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
  customPath: string;
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
  customPath: "",
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
  { number: 2, label: "Preview" },
  { number: 3, label: "Name & Price" },
  { number: 4, label: "Share" },
];

async function saveDraftToServer(
  wizard: WizardState,
  currentStep: number,
  userEditedName: boolean
) {
  try {
    await fetch("/api/wizard-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wizardState: wizard, currentStep, userEditedName }),
    });
  } catch {
    // Network failure — silent, will retry on next debounce
  }
}

async function loadDraftFromServer(): Promise<{
  wizard: WizardState;
  currentStep: number;
  userEditedName: boolean;
} | null> {
  try {
    const res = await fetch("/api/wizard-drafts");
    const json = await res.json();
    if (!json.ok || !json.draft) return null;
    const d = json.draft;
    if (d.current_step >= 4) return null;
    return {
      wizard: d.wizard_state as WizardState,
      currentStep: d.current_step,
      userEditedName: d.user_edited_name,
    };
  } catch {
    return null;
  }
}

async function clearDraftFromServer() {
  try {
    await fetch("/api/wizard-drafts", { method: "DELETE" });
  } catch {}
}

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
  const [draftAvailable, setDraftAvailable] = useState<{
    wizard: WizardState;
    currentStep: number;
    userEditedName: boolean;
  } | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  // Check for Supabase draft on mount
  useEffect(() => {
    const resumeParam = new URLSearchParams(window.location.search).get("resume");

    (async () => {
      const draft = await loadDraftFromServer();
      if (draft) {
        const hasProgress =
          draft.currentStep > 1 ||
          (draft.currentStep === 1 && draft.wizard.selectedEntities.length > 0);
        if (hasProgress) {
          if (resumeParam === "supabase") {
            // Auto-resume when coming from the portals list "Resume" button
            setWizard(draft.wizard);
            setCurrentStep(draft.currentStep);
            setUserEditedName(draft.userEditedName);
          } else {
            setDraftAvailable(draft);
          }
        }
      }
      setDraftChecked(true);
    })();
  }, []);

  // Resume draft handler
  const handleResumeDraft = useCallback(() => {
    if (!draftAvailable) return;
    setWizard(draftAvailable.wizard);
    setCurrentStep(draftAvailable.currentStep);
    setUserEditedName(draftAvailable.userEditedName);
    setDraftAvailable(null);
  }, [draftAvailable]);

  // Dismiss draft handler
  const handleDismissDraft = useCallback(() => {
    clearDraftFromServer();
    setDraftAvailable(null);
  }, []);

  // Data
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [portalBaseUrl, setPortalBaseUrl] = useState<string | null>(null);
  const [customDomainInfo, setCustomDomainInfo] = useState<{
    domain: string;
    verified: boolean;
  } | null>(null);

  // ── Plan limit gate ──────────────────────────────────────
  const [limitCheck, setLimitCheck] = useState<{
    allowed: boolean;
    current: number;
    limit: number;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.usage?.portals) {
          const p = data.usage.portals;
          const limit = p.limit === Infinity ? 999 : p.limit;
          const trialExpired =
            data.plan_status === "trialing" &&
            data.trial_ends_at &&
            new Date(data.trial_ends_at) < new Date();
          setLimitCheck({
            allowed: !trialExpired && p.current < limit,
            current: p.current,
            limit,
            reason: trialExpired
              ? "trial_expired"
              : p.current >= limit
                ? "limit_reached"
                : undefined,
          });
        }
      })
      .catch(() => {});
  }, []);

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

        // Fetch tenant domain info for URL generation
        try {
          const domainRes = await fetch("/api/settings/domains");
          const domainJson = await domainRes.json();
          if (domainJson.ok && domainJson.domain) {
            setCustomDomainInfo({ domain: domainJson.domain, verified: domainJson.verified });
            if (domainJson.verified) {
              setPortalBaseUrl(`https://${domainJson.domain}`);
            }
          }
        } catch {
          // Non-fatal — falls back to window.location.origin
        }

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
                healthStatus?: 'healthy' | 'degraded' | 'critical' | 'no-data' | 'aggregate-only';
                health_status?: 'healthy' | 'degraded' | 'critical' | 'no-data' | 'aggregate-only';
                hasEvents?: boolean;
                has_events?: boolean;
              }) => ({
                id: e.entityUuid ?? e.id ?? "",
                source_id: e.source_id ?? e.sourceId ?? "",
                display_name: e.display_name ?? e.name ?? "",
                entity_kind: e.entity_kind ?? e.kind ?? "",
                external_id: e.external_id ?? e.externalId ?? "",
                platform_type: e.platform_type ?? e.platform ?? "",
                source_name: e.source_name ?? e.sourceName ?? e.platform ?? "Unknown",
                last_seen_at: e.last_seen_at ?? e.lastSeenAt ?? null,
                healthStatus: e.healthStatus ?? e.health_status ?? undefined,
                hasEvents: e.hasEvents ?? e.has_events ?? undefined,
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

  // ── Ref to track latest draft-worthy state for unmount save ──
  const draftRef = useRef({ wizard, currentStep, userEditedName, draftChecked });
  useEffect(() => {
    draftRef.current = { wizard, currentStep, userEditedName, draftChecked };
  }, [wizard, currentStep, userEditedName, draftChecked]);

  // ── Auto-save draft to Supabase (debounced) ──
  useEffect(() => {
    if (!draftChecked) return;
    if (currentStep >= 4) return;
    if (currentStep === 1 && wizard.selectedEntities.length === 0) return;

    const timer = setTimeout(() => {
      saveDraftToServer(wizard, currentStep, userEditedName);
    }, 1500);

    return () => clearTimeout(timer);
  }, [draftChecked, wizard, currentStep, userEditedName]);

  // ── Save draft on unmount (navigation away) ──
  useEffect(() => {
    return () => {
      const {
        wizard: w,
        currentStep: step,
        userEditedName: edited,
        draftChecked: checked,
      } = draftRef.current;
      if (!checked) return;
      if (step >= 4) return;
      if (step === 1 && w.selectedEntities.length === 0) return;
      saveDraftToServer(w, step, edited);
    };
  }, []);

  // ── Auto-fill platform when source changes ────────────────
  useEffect(() => {
    if (wizard.selectedSourceId) {
      const source = sources.find((s) => s.id === wizard.selectedSourceId);
      if (source) update({ selectedPlatform: source.type });
    }
  }, [wizard.selectedSourceId, sources, update]);

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
        return true; // Preview is informational
      case 3:
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
      const entities = wizard.selectedEntities;
      if (entities.length === 0) return;

      const primaryEntity = entities[0];

      const body: Record<string, unknown> = {
        name: wizard.name.trim(),
        sourceId: primaryEntity.sourceId,
        entityId: primaryEntity.id,
        entityIds: entities.map((e) => ({ id: e.id, sourceId: e.sourceId })),
        surfaceType: wizard.surfaceType,
        accessType: stripeConnected ? wizard.accessType : "magic_link",
        pricingType: stripeConnected ? wizard.pricingType : "free",
        priceCents:
          stripeConnected && wizard.accessType === "stripe_gate"
            ? wizard.priceCents
            : 0,
        clientId: wizard.clientId.trim() || undefined,
        description: wizard.description.trim() || undefined,
      };

      if (wizard.accessType === "stripe_gate" && wizard.slug) {
        body.slug = wizard.slug;
      }

      // Send custom_path if the agency edited it
      if (wizard.customPath.trim()) {
        body.customPath = wizard.customPath.trim();
      }

      const res = await fetch("/api/client-portals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setSubmitError(json.error || "Failed to create portal");
        return;
      }

      const created = json.offering;

      update({
        createdOffering: created || null,
        createdOfferings: [created],
        creationErrors: [],
        magicLink: json.magicLink ?? null,
        productUrl: json.productUrl ?? null,
        customPath: json.customPath ?? wizard.customPath,
      });
      clearDraftFromServer();
      trackPortalCreated({
        surfaceType: wizard.surfaceType,
        accessType: stripeConnected ? wizard.accessType : "magic_link",
        platform: primaryEntity.platform || "unknown",
        pricingType: stripeConnected ? wizard.pricingType : "free",
      });
      setCurrentStep(4);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }, [wizard, submitting, stripeConnected, update]);

  // ── Navigation ────────────────────────────────────────────
  const goBack = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    if (currentStep === 3) {
      handleSubmit();
    } else {
      setCurrentStep((s) => Math.min(4, s + 1));
    }
  };

  // ── Batch flow: Create Another (Same Config) ─────────────
  const handleCreateAnother = () => {
    clearDraftFromServer();
    setUserEditedName(false);
    setWizard({ ...INITIAL_STATE, clientId: prefilledClientId });
    setCurrentStep(1);
    setSubmitError(null);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* Plan limit gate */}
      {limitCheck && !limitCheck.allowed && (
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Link
            href="/control-panel/client-portals"
            className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Client Portals
          </Link>
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              {limitCheck.reason === "trial_expired"
                ? "Your free trial has expired"
                : "Portal limit reached"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              {limitCheck.reason === "trial_expired"
                ? "Subscribe to a plan to continue creating client portals."
                : `You've used ${limitCheck.current} of ${limitCheck.limit} portals on your current plan. Upgrade to create more.`}
            </p>
            <Link
              href="/control-panel/settings?tab=billing"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {limitCheck.reason === "trial_expired" ? "Subscribe Now" : "Upgrade Plan"}
            </Link>
          </div>
        </div>
      )}

      {/* Normal wizard — only show when allowed */}
      {(!limitCheck || limitCheck.allowed) && (
        <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/control-panel/client-portals"
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

      {/* Draft resume banner */}
      {draftChecked && draftAvailable && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
              <ArrowLeft className="h-3 w-3 text-blue-600" />
            </div>
            <p className="text-sm text-slate-700">
              You have an unfinished portal draft.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDismissDraft}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-100"
            >
              Start fresh
            </button>
            <button
              type="button"
              onClick={handleResumeDraft}
              className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-blue-700"
            >
              Resume
            </button>
          </div>
        </div>
      )}

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
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Portal Title <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-0.5 text-xs text-gray-400">
                    This is the name your client will see at the top of their dashboard.
                  </p>
                  <input
                    type="text"
                    value={wizard.name}
                    onChange={(e) => {
                      setUserEditedName(true);
                      update({ name: e.target.value });
                    }}
                    placeholder="e.g. Smith Dental — Voice Dashboard"
                    className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <PortalPreview
                  platformType={
                    // Always pass a single clean platform string, not a joined list.
                    // getSkeletonForPlatformMix receives entityCount separately.
                    wizard.selectedEntities?.[0]?.platform || wizard.selectedPlatform || "vapi"
                  }
                  sourceId={wizard.selectedSourceId || ""}
                  entityName={
                    wizard.selectedEntities && wizard.selectedEntities.length > 1
                      ? `${wizard.selectedEntities[0].displayName} + ${wizard.selectedEntities.length - 1} more`
                      : wizard.selectedEntities?.[0]?.displayName || wizard.name || "Your Portal"
                  }
                  entityExternalIds={
                    wizard.selectedEntities && wizard.selectedEntities.length > 0
                      ? wizard.selectedEntities.map((e) => e.externalId).filter(Boolean).join(",")
                      : undefined
                  }
                  entityCount={wizard.selectedEntities?.length ?? 1}
                  surfaceType="analytics"
                  customTitle={wizard.name}
                />
              </div>
            )}
            {currentStep === 3 && (
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
                  customPath={wizard.customPath}
                  onCustomPathChange={(customPath) => update({ customPath })}
                  onAccessChange={(accessType) => update({ accessType })}
                  onPricingChange={(pricingType, priceCents) =>
                    update({ pricingType, priceCents })
                  }
                  stripeConnected={stripeConnected}
                  platform={wizard.selectedPlatform}
                  surfaceType={wizard.surfaceType}
                  submitError={submitError}
                  customDomainInfo={customDomainInfo}
                />
                {wizard.selectedEntities.length > 1 && (
                  <p className="mt-1 text-xs text-tremor-content dark:text-dark-tremor-content">
                    Multiple selections will be combined into one unified portal.
                  </p>
                )}
              </>
            )}
            {currentStep === 4 && (
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
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${portalBaseUrl || window.location.origin}/client/${o.token}`
                              );
                              trackPortalShared("magic_link");
                            }}
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
                    customPath={wizard.customPath || undefined}
                    accessType={wizard.accessType}
                    surfaceType={wizard.surfaceType}
                    onCreateAnother={handleCreateAnother}
                    portalBaseUrl={portalBaseUrl || undefined}
                    customDomainInfo={customDomainInfo}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Navigation Buttons — hidden on Step 4 */}
      {currentStep < 4 && (
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
              : currentStep === 3
                ? "Create Portal →"
                : "Continue →"}
          </button>
        </div>
      )}
        </div>
      )}
    </>
  );
}
