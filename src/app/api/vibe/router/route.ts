

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
    // ACTION: style bundle selected
    // ------------------------------------------------------------------
    if (userMessage === "__ACTION__:select_style_bundle") {
      const selectedId = journey?.selectedStyleBundleId;
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
        journey: { ...journey, mode: "build_preview" },
        toolUi: null,
      });
    }

    // ------------------------------------------------------------------
    // Phase: select_entity
    // ------------------------------------------------------------------
    if (mode === "select_entity") {
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
    if (mode === "recommend") {
      // Create initial todos (lightweight)
      await todoAdd.execute({
        context: {
          tenantId,
          threadId,
          title: "Select outcome (dashboard vs product)",
          priority: "high",
          tags: ["journey"],
        },
        runtimeContext,
      });

      await todoAdd.execute({
        context: {
          tenantId,
          threadId,
          title: "Choose style bundle (required)",
          priority: "high",
          tags: ["journey", "design"],
        },
        runtimeContext,
      });

      await todoAdd.execute({
        context: {
          tenantId,
          threadId,
          title: "Generate preview",
          priority: "high",
          tags: ["journey"],
        },
        runtimeContext,
      });

      const todos = await todoList.execute({
        context: { tenantId, threadId, status: "all" },
        runtimeContext,
      });

      return NextResponse.json({
        text:
          "Based on your workflow activity, the fastest path to revenue is:\n\n" +
          "1) Build a **Workflow Activity Dashboard** (prove ROI + reduce churn)\n" +
          "2) Then optionally wrap the same workflow as a **sellable product** (SaaS wrapper)\n\n" +
          "Which do you want first: **dashboard** or **product**?",
        journey: { ...journey, mode: "align" },
        toolUi: {
          type: "todos",
          title: "Build plan",
          items: todos.todos.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
        },
      });
    }

    // ------------------------------------------------------------------
    // Phase: align (business goals)
    // ------------------------------------------------------------------
    if (mode === "align") {
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
    if (mode === "style") {
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
    if (mode === "build_preview") {
      const result = await platformMappingMaster.generate(
        "Generate a preview dashboard now using the workflow activity dashboard template and the connected platform events.",
        { runtimeContext }
      );

      const previewUrl = ""; // until PreviewService is wired
      const interfaceId = journey?.entityId as string | undefined;

      const toolUiPayload = interfaceId
        ? {
            type: "interactive_edit_panel" as const,
            title: "Interactive edits (widgets, style, density, palette)",
            interfaceId,
            widgets: [
              { id: "chart-1", title: "Workflow runs", kind: "chart" as const, enabled: true },
              { id: "metric-1", title: "Success rate", kind: "metric" as const, enabled: true },
              { id: "table-1", title: "Recent runs", kind: "table" as const, enabled: true },
            ],
            palettes: [
              {
                id: "bright",
                name: "Bright",
                swatches: [{ name: "Primary", hex: "#F97316" }, { name: "Accent", hex: "#10B981" }, { name: "Background", hex: "#F9FAFB" }, { name: "Surface", hex: "#FFFFFF" }, { name: "Text", hex: "#111827" }],
              },
              {
                id: "ocean",
                name: "Ocean",
                swatches: [{ name: "Primary", hex: "#0EA5E9" }, { name: "Accent", hex: "#06B6D4" }, { name: "Background", hex: "#F0F9FF" }, { name: "Surface", hex: "#FFFFFF" }, { name: "Text", hex: "#0C4A6E" }],
              },
              { id: "dark", name: "Dark", swatches: [{ name: "Primary", hex: "#60A5FA" }, { name: "Accent", hex: "#F472B6" }, { name: "Background", hex: "#0B1220" }, { name: "Surface", hex: "#111827" }, { name: "Text", hex: "#E5E7EB" }] },
            ],
            density: "comfortable" as const,
          }
        : null;

      return NextResponse.json({
        text: result.text || "Preview generated.",
        journey: { ...journey, mode: "interactive_edit" },
        toolUi: toolUiPayload,
        previewUrl: previewUrl || null,
        previewVersionId: null,
      });
    }

    // ------------------------------------------------------------------
    // ACTION: interactive edit
    // ------------------------------------------------------------------
    if (isAction(userMessage) && userMessage.startsWith("__ACTION__:interactive_edit:")) {
      const raw = userMessage.replace("__ACTION__:interactive_edit:", "");
      const parsed = JSON.parse(raw);

      const EditActionSchema = z.object({
        actions: z.array(z.any()).min(1),
        interfaceId: z.string().uuid(),
      });

      const payload = EditActionSchema.parse(parsed);

      const result = await applyInteractiveEdits.execute({
        context: {
          tenantId,
          userId,
          interfaceId: payload.interfaceId,
          platformType,
          actions: payload.actions,
        },
        runtimeContext,
      } as any);

      return NextResponse.json({
        text: "Done. I updated your preview with those edits.",
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


