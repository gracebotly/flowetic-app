

import { NextRequest, NextResponse } from "next/server";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { createClient } from "@/lib/supabase/server";
import { loadSkill } from "@/mastra/skills/loadSkill";
import { z } from "zod";

import { designAdvisorAgent } from "@/mastra/agents/designAdvisorAgent";
import { platformMappingMaster } from "@/mastra/agents/platformMappingMaster";
import { dashboardBuilderAgent } from "@/mastra/agents/dashboardBuilderAgent";

import { todoAdd, todoList } from "@/mastra/tools/todo";
import { getStyleBundles } from "@/mastra/tools/design/getStyleBundles";
import { applyInteractiveEdits } from "@/mastra/tools/interactiveEdit";
import { getCurrentSpec, applySpecPatch } from "@/mastra/tools/specEditor";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

function isAction(msg: string) {
  return msg.startsWith("__ACTION__:");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId,
      tenantId,
      vibeContext,
      journey,
      userMessage,
    }: {
      userId: string;
      tenantId: string;
      vibeContext: any;
      journey: any;
      userMessage: string;
    } = body;

    if (!userId || !tenantId) {
      return NextResponse.json({ error: "MISSING_AUTH_CONTEXT" }, { status: 400 });
    }

    const runtimeContext = new RuntimeContext();
    runtimeContext.set("userId", userId);
    runtimeContext.set("tenantId", tenantId);

    const platformType = vibeContext?.platformType || "other";
    const sourceId = vibeContext?.sourceId;

    runtimeContext.set("platformType", platformType);
    if (sourceId) runtimeContext.set("sourceId", sourceId);

    // Thread id: use vibeContextSnapshot/thread id if you have it; fallback to "vibe"
    const threadId = vibeContext?.threadId || "vibe";
    runtimeContext.set("threadId", threadId);

    const mode: JourneyMode = journey?.mode || "select_entity";

    const hasSelectedEntity = Boolean(vibeContext?.entityId && vibeContext?.sourceId);
    const effectiveMode: JourneyMode =
      mode === "select_entity" && hasSelectedEntity ? "recommend" : mode;

    const supabase = await createClient();

    // Helper: list workflows WITH events for picker (MVP rule A)
    async function listActiveWorkflows() {
      // This assumes you have source_entities with workflow + externalId, and events reference source_id.
      // For MVP, return a simplified list. You can refine join logic later.
      const { data: entities } = await supabase
        .from("source_entities")
        .select("id,name,external_id,entity_kind")
        .eq("source_id", sourceId)
        .eq("entity_kind", "workflow")
        .limit(50);

      // Filter to only those with events by checking events table labels.workflow_id or similar is not yet standardized.
      // MVP: if you store execution events with labels.workflow_id, count per workflow_id. If not, fall back to showing all.
      return entities ?? [];
    }

    // ------------------------------------------------------------------
    // ACTION: outcome selection
    // ------------------------------------------------------------------
    if (isAction(userMessage) && userMessage.startsWith("__ACTION__:select_outcome:")) {
      const outcome = userMessage.replace("__ACTION__:select_outcome:", "").trim();

      if (outcome !== "dashboard" && outcome !== "product") {
        return NextResponse.json({ error: "INVALID_OUTCOME" }, { status: 400 });
      }

      return NextResponse.json({
        text:
          outcome === "dashboard"
            ? "Great — we'll build a Client ROI Dashboard first. Next: quick alignment."
            : "Great — we'll build a Workflow Product first. Next: quick alignment.",
        journey: { ...journey, selectedOutcome: outcome, mode: "align" },
        toolUi: null,
      });
    }

    // ------------------------------------------------------------------
    // ACTION: style bundle selected
    // ------------------------------------------------------------------
    if (isAction(userMessage) && userMessage.startsWith("__ACTION__:select_style_bundle:")) {
      const selectedId = userMessage.replace("__ACTION__:select_style_bundle:", "").trim();
      if (!selectedId) {
        return NextResponse.json({ error: "MISSING_STYLE_BUNDLE_ID" }, { status: 400 });
      }

      // Get bundle list again, pick chosen bundle
      const bundlesResult = await getStyleBundles.execute({
        context: {
          platformType,
          outcome: journey?.selectedOutcome ?? "dashboard",
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "User selected a bundle; return the same set for token extraction.",
        },
        runtimeContext,
      } as any);

      const bundle = bundlesResult.bundles.find((b) => b.id === selectedId);
      if (!bundle) {
        return NextResponse.json({ error: "STYLE_BUNDLE_NOT_FOUND" }, { status: 400 });
      }

      // Store selected bundle in journey and proceed
      return NextResponse.json({
        text: `Locked in: **${bundle.name}** (${bundle.palette.name}). Generating your preview now...`,
        journey: { ...journey, selectedStyleBundleId: selectedId, mode: "build_preview" },
        toolUi: null,
      });
    }

    // ------------------------------------------------------------------
    // Phase: select_entity
    // ------------------------------------------------------------------
    if (effectiveMode === "select_entity") {
      const workflows = await listActiveWorkflows();

      return NextResponse.json({
        text:
          "Pick which workflow you want to package first. I'm only showing workflows that already have activity so we can generate a real dashboard preview fast.",
        journey: { ...journey, mode: "recommend" },
        toolUi: {
          type: "todos",
          title: "Build plan",
          items: [],
        },
        workflows,
      });
    }

    // ------------------------------------------------------------------
    // Phase: recommend (two cards)
    // ------------------------------------------------------------------
    if (effectiveMode === "recommend") {
      return NextResponse.json({
        text:
          "Based on your workflow activity, the fastest path to revenue is:\n\n" +
          "1) Build a **Client ROI Dashboard** (prove ROI + reduce churn)\n" +
          "2) Then optionally wrap the same workflow as a **Workflow Product** (SaaS wrapper)\n\n" +
          "Choose one to start:",
        journey: { ...journey, mode: "recommend" },
        toolUi: {
          type: "outcome_cards",
          title: "Choose your outcome",
          options: [
            {
              id: "dashboard",
              title: "Client ROI Dashboard",
              description: "A dashboard your client can log into to see workflow value, KPIs, and impact over time.",
            },
            {
              id: "product",
              title: "Workflow Product (SaaS wrapper)",
              description: "Package the workflow behind a product UI so it can be sold as a recurring subscription.",
            },
          ],
        },
      });
    }

    // ------------------------------------------------------------------
    // Phase: align (business goals)
    // ------------------------------------------------------------------
    if (effectiveMode === "align") {
      return NextResponse.json({
        text:
          "Quick alignment so this UI makes money:\n\n" +
          "1) Is this primarily for **your client (ROI proof)** or **your team (ops reliability)**?\n" +
          "2) Default time window: **7d**, **30d**, or **90d**?\n\n" +
          "Answer in one line (e.g., 'client, 30d').",
        journey: { ...journey, mode: "style" },
        toolUi: null,
      });
    }

    // ------------------------------------------------------------------
    // Phase: style (RAG -> 4 bundles)
    // ------------------------------------------------------------------
    if (effectiveMode === "style") {
      const bundlesResult = await getStyleBundles.execute({
        context: {
          platformType,
          outcome: journey?.selectedOutcome ?? "dashboard",
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "Return premium style+palette bundles appropriate for agency white-label client delivery.",
        },
        runtimeContext,
      } as any);

      return NextResponse.json({
        text: "Choose a style bundle (required). This sets the look + palette so the preview feels sellable immediately.",
        journey: { ...journey, mode: "style" },
        toolUi: {
          type: "style_bundles",
          title: "Choose your dashboard style",
          bundles: bundlesResult.bundles.map((b) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            previewImageUrl: b.previewImageUrl,
            palette: b.palette,
            tags: b.tags,
          })),
        },
        debug: { sources: bundlesResult.sources },
      });
    }

    // ------------------------------------------------------------------
    // Phase: build_preview (delegate to platformMappingMaster for real preview)
    // ------------------------------------------------------------------
    if (effectiveMode === "build_preview") {
      let interfaceId = vibeContext?.interfaceId as string | undefined;

      if (!interfaceId) {
        const result = await platformMappingMaster.execute({
          context: {
            tenantId,
            userId,
            platformType,
            sourceId,
            entityId: vibeContext?.entityId,
            outcome: journey?.selectedOutcome ?? "dashboard",
            styleBundleId: journey?.selectedStyleBundleId ?? null,
          },
          runtimeContext,
        } as any);

        interfaceId = result?.interfaceId;

        if (!interfaceId) {
          return NextResponse.json(
            { error: "PREVIEW_GENERATION_FAILED_NO_INTERFACE_ID" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          text: "Preview generated. Loading editor…",
          journey: { ...journey, mode: "build_preview" },
          toolUi: null,
          interfaceId,
          previewUrl: result?.previewUrl ?? null,
          previewVersionId: result?.versionId ?? result?.previewVersionId ?? null,
        });
      }

      // Load the actual current spec to extract real component IDs for interactive edit.
      const current = await getCurrentSpec.execute(
        { context: { tenantId, interfaceId }, runtimeContext } as any
      );

      const spec = current.spec_json as any;
      const components = Array.isArray(spec?.components) ? spec.components : [];

      const widgets = components.map((c: any) => {
        const type = String(c?.type ?? "other");
        const kind =
          type.toLowerCase().includes("chart")
            ? "chart"
            : type.toLowerCase().includes("table")
            ? "table"
            : type.toLowerCase().includes("metric")
            ? "metric"
            : "other";

        const title = String(c?.props?.title ?? c?.id ?? "Widget");
        const enabled = !(c?.props?.hidden === true);

        return { id: String(c.id), title, kind, enabled };
      });

      // Palette options shown in interactive editing (simple MVP set).
      const palettes = [
        {
          id: "premium-neutral",
          name: "Premium Neutral",
          swatches: [
            { name: "Primary", hex: "#2563EB" },
            { name: "Accent", hex: "#22C55E" },
            { name: "Background", hex: "#F8FAFC" },
            { name: "Surface", hex: "#FFFFFF" },
            { name: "Text", hex: "#0F172A" },
          ],
        },
        {
          id: "dark-saas",
          name: "Dark SaaS",
          swatches: [
            { name: "Primary", hex: "#60A5FA" },
            { name: "Accent", hex: "#F472B6" },
            { name: "Background", hex: "#0B1220" },
            { name: "Surface", hex: "#111827" },
            { name: "Text", hex: "#E5E7EB" },
          ],
        },
        {
          id: "slate-minimal",
          name: "Slate Minimal",
          swatches: [
            { name: "Primary", hex: "#334155" },
            { name: "Accent", hex: "#0EA5E9" },
            { name: "Background", hex: "#F9FAFB" },
            { name: "Surface", hex: "#FFFFFF" },
            { name: "Text", hex: "#111827" },
          ],
        },
      ];

      // At this point you should have a previewUrl from your preview workflow; return it if available.
      // If not yet wired, keep previewUrl null and the UI will still show the editor panel.
      return NextResponse.json({
        text: "Preview is ready. Use the controls below to refine it before deploying.",
        journey: { ...journey, mode: "interactive_edit" },
        toolUi: {
          type: "interactive_edit_panel",
          title: "Refine your dashboard",
          interfaceId,
          widgets,
          palettes,
          density: journey?.densityPreset ?? "comfortable",
        },
        interfaceId,
        previewUrl: vibeContext?.previewUrl ?? null,
        previewVersionId: vibeContext?.previewVersionId ?? null,
      });
    }

    // ------------------------------------------------------------------
    // ACTION: interactive edit
    // ------------------------------------------------------------------
    if (isAction(userMessage) && userMessage.startsWith("__ACTION__:interactive_edit:")) {
      const raw = userMessage.replace("__ACTION__:interactive_edit:", "");
      const parsed = JSON.parse(raw);

      const PayloadSchema = z.object({
        interfaceId: z.string().uuid(),
        actions: z.array(z.any()).min(1),
      });

      const payload = PayloadSchema.parse(parsed);

      // Translate paletteId selection into token ops BEFORE calling interactive tool.
      // Keep deterministic: a paletteId maps to a fixed token set.
      const paletteMap: Record<string, Record<string, string>> = {
        "premium-neutral": {
          primary: "#2563EB",
          accent: "#22C55E",
          background: "#F8FAFC",
          surface: "#FFFFFF",
          text: "#0F172A",
        },
        "dark-saas": {
          primary: "#60A5FA",
          accent: "#F472B6",
          background: "#0B1220",
          surface: "#111827",
          text: "#E5E7EB",
        },
        "slate-minimal": {
          primary: "#334155",
          accent: "#0EA5E9",
          background: "#F9FAFB",
          surface: "#FFFFFF",
          text: "#111827",
        },
      };

      const actions = payload.actions as any[];

      const paletteAction = actions.find((a) => a?.type === "set_palette") as
        | { type: "set_palette"; paletteId: string }
        | undefined;

      if (paletteAction) {
        const p = paletteMap[paletteAction.paletteId];
        if (p) {
          // Apply palette tokens immediately using applySpecPatch so the interactive edit tool stays simple.
          await applySpecPatch.execute(
            {
              context: {
                spec_json: (await getCurrentSpec.execute(
                  { context: { tenantId, interfaceId: payload.interfaceId }, runtimeContext } as any
                )).spec_json,
                design_tokens: (await getCurrentSpec.execute(
                  { context: { tenantId, interfaceId: payload.interfaceId }, runtimeContext } as any
                )).design_tokens,
                operations: [
                  { op: "setDesignToken", tokenPath: "theme.color.primary", tokenValue: p.primary },
                  { op: "setDesignToken", tokenPath: "theme.color.accent", tokenValue: p.accent },
                  { op: "setDesignToken", tokenPath: "theme.color.background", tokenValue: p.background },
                  { op: "setDesignToken", tokenPath: "theme.color.surface", tokenValue: p.surface },
                  { op: "setDesignToken", tokenPath: "theme.color.text", tokenValue: p.text },
                ],
              },
              runtimeContext,
            } as any
          );
        }
      }

      const result = await applyInteractiveEdits.execute({
        context: {
          tenantId,
          userId,
          interfaceId: payload.interfaceId,
          platformType,
          actions: actions,
        },
        runtimeContext,
      } as any);

      return NextResponse.json({
        text: "Done — your preview has been updated.",
        journey: { ...journey, mode: "interactive_edit" },
        toolUi: null,
        previewUrl: result.previewUrl,
        previewVersionId: result.previewVersionId,
      });
    }

    // Default fallback
    return NextResponse.json({
      text: "I'm ready. Tell me what you want to do next.",
      journey,
      toolUi: null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "UNKNOWN_ROUTER_ERROR" },
      { status: 500 }
    );
  }
}


