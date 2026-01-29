

import { NextRequest, NextResponse } from "next/server";
import { RequestContext } from "@mastra/core/request-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
import { loadSkill } from "@/mastra/skills/loadSkill";
import { z } from "zod";

import { designAdvisorAgent } from "@/mastra/agents/designAdvisorAgent";

import { dashboardBuilderAgent } from "@/mastra/agents/dashboardBuilderAgent";


import { todoAdd, todoList } from "@/mastra/tools/todo";
import { getStyleBundles } from "@/mastra/tools/design/getStyleBundles";
import { applyInteractiveEdits } from "@/mastra/tools/interactiveEdit";
import { getCurrentSpec, applySpecPatch } from "@/mastra/tools/specEditor";
import { callTool } from "@/mastra/lib/callTool";

import { getOutcomes } from "@/mastra/tools/outcomes";
import { ensureMastraThreadId } from "@/mastra/lib/ensureMastraThread";
import { getMastra } from "@/mastra/index";
import { OUTCOMES } from "@/data/outcomes";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy"
  | "consultation";

function toMetricId(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[%]/g, " percent")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dedupeStringsByMetricId(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const id = toMetricId(l);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(l);
  }
  return out;
}

/**
 * Maps business outcome IDs to the style bundle type expected by getStyleBundles tool.
 * Bridges business layer (user selection) with technical layer (design system).
 * 
 * @param outcomeId - Outcome ID from OUTCOMES catalog or user selection
 * @returns 'dashboard' | 'product' for getStyleBundles tool
 */
function mapOutcomeToStyleType(outcomeId: string | undefined | null): 'dashboard' | 'product' {
  const normalized = String(outcomeId || "").trim().toLowerCase();
  
  if (!normalized) {
    return 'dashboard'; // Default fallback
  }
  
  // Look up outcome in OUTCOMES catalog to use its category
  const outcome = OUTCOMES.find((o: any) => o?.id === normalized);
  
  if (outcome?.category) {
    // Map category to style type
    if (outcome.category === 'product') {
      return 'product';
    }
    // Both 'dashboard' and 'operations' map to 'dashboard'
    return 'dashboard';
  }
  
  // Fallback: keyword-based heuristics if category missing
  if (normalized.includes('product') || 
      normalized.includes('portal') || 
      normalized.includes('saas') ||
      normalized.includes('marketplace')) {
    return 'product';
  }
  
  // Default: dashboard (most common case)
  return 'dashboard';
}

type ToolUi =
  | {
      type: "outcome_cards";
      title: string;
      options: Array<{ id: string; title: string; description: string; previewImageUrl?: string; tags?: string[] }>;
    }
  | {
      type: "storyboard_cards";
      title: string;
      options: Array<{ id: string; title: string; description: string; kpis: string[] }>;
    }
  | {
      type: "style_bundles";
      title: string;
      bundles: any[];
    }
  | {
      type: "todos";
      title: string;
      items: any[];
    }
  | {
      type: "interactive_edit_panel";
      title: string;
      interfaceId: string;
      widgets: any[];
      palettes: any[];
      density: "compact" | "comfortable" | "spacious";
    };

// Type definition for getOutcomes tool result
// Matches the outputSchema defined in mastra/tools/outcomes/getOutcomes.ts
type GetOutcomesResult = {
  outcomes: Array<{
    id: string;
    name: string;
    description: string;
    platformTypes: string[];
    category: "dashboard" | "product" | "operations";
    audience: "client" | "internal" | "both";
    metrics: {
      primary: string[];
      secondary: string[];
    };
    previewImageUrl: string;
    tags: string[];
    supportedEventTypes: string[];
    requiredEntityKinds?: string[];
  }>;
  validation: {
    totalOutcomes: number;
    filteredOutcomes: number;
  };
};

function isAction(msg: string) {
  return msg.startsWith("__ACTION__:");
}

function actionToAgentHint(userMessage: string): string {
  if (!isAction(userMessage)) return userMessage;

  if (userMessage.startsWith("__ACTION__:select_outcome:")) {
    const outcome = userMessage.replace("__ACTION__:select_outcome:", "").trim();
    return `System: user selected outcome "${outcome}".`;
  }

  if (userMessage.startsWith("__ACTION__:select_storyboard:")) {
    const storyboardId = userMessage.replace("__ACTION__:select_storyboard:", "").trim();
    return `System: user selected storyboard "${storyboardId}".`;
  }

  if (userMessage.startsWith("__ACTION__:select_style_bundle:")) {
    const bundleId = userMessage.replace("__ACTION__:select_style_bundle:", "").trim();
    return `System: user selected style bundle "${bundleId}".`;
  }

  // Leave other actions as-is
  return `System: received action "${userMessage}".`;
}

const NO_ROADMAP_RULES = [
  "Rules:",
  "- Do NOT explain the whole process or list the phases/steps.",
  "- Do NOT write a roadmap (no numbered onboarding plan).",
  "- Keep it premium and brief.",
  "- Use plain language for non-technical users.",
  "- Avoid jargon like: execution status, success rate, optimize processes, workflow activity dashboard.",
].join("\n");

function isValidOutcomeId(id: string): boolean {
  const normalized = String(id || "").trim();
  if (!normalized) return false;
  return OUTCOMES.some((o: any) => o?.id === normalized);
}

export async function POST(req: NextRequest) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: "DATABASE_URL_MISSING" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

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

    const platformType = vibeContext?.platformType || "other";
    const sourceId = vibeContext?.sourceId;

    const skillMD = await loadSkill(platformType);

    const runtimeContext = {
      userId,
      tenantId,
      platformType,
      sourceId,
      skillMD,
      get: (key: string) => {
        const obj: any = { userId, tenantId, platformType, sourceId, skillMD };
        return obj[key];
      }
    } as any;

    // Enhance system prompt with workflow context
    let workflowContext = "";
    if (vibeContext?.skillMD) {
      workflowContext = `

## INDEXED WORKFLOW CONTEXT

You are helping build a dashboard for this specific workflow:

${vibeContext.skillMD}

**CRITICAL INSTRUCTIONS:**
1. Your recommendations MUST reference this workflow's actual capabilities, data points, and business purpose
2. DO NOT give generic advice - be specific about what this workflow does
3. When recommending outcomes, explain HOW this workflow's data maps to the outcome
4. Use plain business language - avoid technical jargon like "schema", "API", "integration"
5. Reference specific workflow steps, triggers, or outputs when explaining your recommendation

Platform: ${vibeContext.platformType}
Source ID: ${vibeContext.sourceId}
${vibeContext.entityId ? `Entity ID: ${vibeContext.entityId}` : ''}
`;
    }

    const baseSystemPrompt = `You are the Getflowetic vibe agent helping agencies build client dashboards from AI automation workflows.

Your personality:
- Consultative business advisor (not a technical engineer)
- Make strong recommendations based on workflow analysis
- Use plain language: "prove ROI", "quick status check", "hide your prompts" (NOT "stakeholder value", "schema", "API")
- Fast lane by default: recommend → show cards → proceed
- Deep lane only when user says "not sure" or "help me decide"

Journey phases:
- Phase 1: Recommend Dashboard or Product based on workflow type
- Phase 2: Recommend Visual Story style (Performance Snapshot, Deep Analytics, or Impact Report)
- Phase 3: Style bundle selection
- Phase 4: Build preview
- Phase 5: Interactive editing
- Phase 6: Deploy
`;

    const enhancedSystemPrompt = baseSystemPrompt + workflowContext;

    // Ensure Mastra thread exists and get Mastra thread ID
    const journeyThreadId = vibeContext?.threadId || "vibe";
    const mastraThreadId = await ensureMastraThreadId({
      tenantId,
      journeyThreadId,
      resourceId: userId,
      title: "Flowetic Conversation",
    });
    (runtimeContext as any).threadId = mastraThreadId;

    const mastraMemory = {
      resource: String(userId),
      thread: String(mastraThreadId),
    } as const;

    // Add context properties to runtimeContext object
    const workflowName = String(vibeContext?.displayName ?? vibeContext?.externalId ?? "").trim();
    if (workflowName) (runtimeContext as any).workflowName = workflowName;
    if (vibeContext?.entityId) (runtimeContext as any).workflowEntityId = String(vibeContext.entityId);
    if (vibeContext?.sourceId) (runtimeContext as any).sourceId = String(vibeContext.sourceId);
    if (journey?.selectedOutcome) (runtimeContext as any).selectedOutcome = String(journey.selectedOutcome);
    if (journey?.selectedStoryboard) (runtimeContext as any).selectedStoryboard = String(journey.selectedStoryboard);

    // --- Normalize requestContext: Mastra expects RequestContext with .set() ---
    const requestContext = new RequestContext();

    // Copy enumerable keys from the existing runtimeContext object
    if (runtimeContext && typeof runtimeContext === "object") {
      for (const [k, v] of Object.entries(runtimeContext as Record<string, unknown>)) {
        // Skip function-valued properties like get()
        if (typeof v === "function") continue;
        requestContext.set(k, v as any);
      }

      // Preserve legacy get() behavior if present (some of your code relies on it)
      const legacyGet = (runtimeContext as any).get;
      if (typeof legacyGet === "function") {
        // Only set if not already present
        if (typeof (requestContext as any).get !== "function") {
          (requestContext as any).get = legacyGet.bind(runtimeContext);
        }
      }
    }

    const mode: JourneyMode = journey?.mode || "select_entity";

    const hasSelectedEntity = Boolean(vibeContext?.entityId && vibeContext?.sourceId);
    const effectiveMode: JourneyMode =
      mode === "select_entity" && hasSelectedEntity ? "recommend" : mode;

    const deepLaneStep = journey?.deepLane?.step as number | undefined;

    if (effectiveMode === "recommend" && deepLaneStep && !isAction(userMessage)) {
      if (deepLaneStep === 1) {
        const nextJourney = {
          ...journey,
          deepLane: {
            step: 2,
            answers: {
              ...(journey?.deepLane?.answers ?? {}),
              q1: userMessage,
            },
          },
        };

        const mastra = getMastra();
        const master = mastra.getAgent("masterRouterAgent" as const);
        const agentRes = await master.generate(
          [
            "System: Deep lane step 2 (final question). User needs help deciding.",
            workflowName ? `System: User's workflow: "${workflowName}".` : "",
            "",
            "TONE: Consultative and helpful (not interrogative)",
            "",
            "OUTPUT STRUCTURE:",
            "1. Acknowledge their answer briefly (1 sentence)",
            "2. Ask ONE final question: Who will use this most often - your team or client?",
            "",
            "EXAMPLE:",
            "Got it. One more quick question: who will mainly use this — your team, or client?",
            "",
            NO_ROADMAP_RULES,
          ].filter(Boolean).join("\n"),
          { 
            requestContext,
            memory: mastraMemory,
          }
        );
        const agentText = String((agentRes as any)?.text ?? "").trim();

        return NextResponse.json({
          text: agentText || "Got it. One more quick question: who will mainly use this — your team, or client?",
          journey: nextJourney,
          toolUi: null, // KEEP cards hidden during deep lane
          vibeContext: { ...(vibeContext ?? {}), skillMD },
          progress: { show: false }, // Hide progress during consultation
        });
      }

      if (deepLaneStep === 2) {
        // Deep lane complete: user answered both questions
        const answers = journey?.deepLane?.answers ?? {};
        
        // Agent generates final recommendation
        const mastra = getMastra();
        const master = mastra.getAgent("masterRouterAgent" as const);
        const agentRes = await master.generate(
          [
            "System: Deep lane complete. Provide final recommendation.",
            workflowName ? `System: User's workflow: "${workflowName}".` : "",
            "",
            "User's answers:",
            `Q1: ${String(answers.q1 ?? "")}`,
            `Q2: ${String(userMessage)}`,
            "",
            "TONE: Confident consultant wrapping up discovery",
            "",
            "OUTPUT STRUCTURE:",
            "1. Transition: 'Based on what you told me...'",
            "2. Recommendation: 'I recommend [Dashboard/Product].'",
            "3. Exactly 2 bullet reasons (tie to their specific answers)",
            "4. Transition: 'Now let's pick the story this will tell.'",
            "",
            "EXAMPLE:",
            "Based on what you told me, I recommend starting with a **Dashboard**.",
            "",
            "• Since this is for proving results to clients, dashboards are perfect for showing ROI",
            "• Your team will use it internally to monitor performance before sharing with clients",
            "",
            "Now let's pick the story this will tell.",
            "",
            NO_ROADMAP_RULES,
          ].filter(Boolean).join("\n"),
          { 
            requestContext,
            memory: mastraMemory,
          }
        );
        const agentText = String((agentRes as any)?.text ?? "").trim();

        // CRITICAL FIX: Determine outcome from answers
        const inferredOutcome = String(answers.q1 ?? "").toLowerCase().includes("product") 
          ? "product" 
          : "dashboard";

        // Transition to Phase 2 (align) automatically
        const nextJourney = {
          ...journey,
          mode: "align" as JourneyMode,
          selectedOutcome: inferredOutcome,
          deepLane: null,
        };

        // Show storyboard cards for Phase 2
        const toolUi: ToolUi = {
          type: "storyboard_cards",
          title: "Choose your KPI Storyboard",
          options: [
            {
              id: "roi_proof",
              title: "ROI Proof (Client-facing)",
              description: "Prove automation value and time saved to drive renewals.",
              kpis: dedupeStringsByMetricId(["Tasks automated", "Time saved", "Success rate", "Executions over time", "Most recent runs"]),
            },
            {
              id: "reliability_ops",
              title: "Reliability Ops (Agency-facing)",
              description: "Operate and debug reliability across workflows quickly.",
              kpis: dedupeStringsByMetricId(["Failure count", "Success rate", "Recent errors", "Avg runtime", "Slowest runs"]),
            },
            {
              id: "delivery_sla",
              title: "Delivery / SLA (Client-facing)",
              description: "Show delivery health and turnaround time trends.",
              kpis: dedupeStringsByMetricId(["Runs completed", "Avg turnaround time", "Incidents this week", "Last successful run", "Status trend"]),
            },
          ],
        };

        return NextResponse.json({
          text: agentText || "Based on your answers, I recommend starting with a Dashboard. Now let's pick the story this will tell.",
          journey: nextJourney,
          toolUi,
          vibeContext: { ...(vibeContext ?? {}), skillMD },
          progress: { 
            show: true, // Agent controls when to show progress
            currentStep: nextJourney.mode === "consultation" ? undefined : 1 // Hide step during consultation
          },
        });
      }
    }

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
    // ACTION: outcome selection (agent-driven copy)
    // ------------------------------------------------------------------
    if (isAction(userMessage) && userMessage.startsWith("__ACTION__:select_outcome:")) {
      const outcome = userMessage.replace("__ACTION__:select_outcome:", "").trim();

      if (!isValidOutcomeId(outcome)) {
        return NextResponse.json({ error: "INVALID_OUTCOME" }, { status: 400 });
      }

      const nextJourney = { ...journey, selectedOutcome: outcome, mode: "align" };

      // Keep your existing storyboard cards UI (the part you like visually)
      const storyboardToolUi: ToolUi = {
        type: "storyboard_cards",
        title: "Choose your KPI Storyboard",
        options: [
          {
            id: "roi_proof",
            title: "ROI Proof (Client-facing)",
            description: "Prove automation value and time saved to drive renewals.",
            kpis: dedupeStringsByMetricId(["Tasks automated", "Time saved", "Success rate", "Executions over time", "Most recent runs"]),
          },
          {
            id: "reliability_ops",
            title: "Reliability Ops (Agency-facing)",
            description: "Operate and debug reliability across workflows quickly.",
            kpis: dedupeStringsByMetricId(["Failure count", "Success rate", "Recent errors", "Avg runtime", "Slowest runs"]),
          },
          {
            id: "delivery_sla",
            title: "Delivery / SLA (Client-facing)",
            description: "Show delivery health and turnaround time trends.",
            kpis: dedupeStringsByMetricId(["Runs completed", "Avg turnaround time", "Incidents this week", "Last successful run", "Status trend"]),
          },
        ],
      };

      // Agent-driven user-facing text, skill-aware with plain language
      const agentInput = actionToAgentHint(userMessage);
      const mastra = getMastra();
      const master = mastra.getAgent("masterRouterAgent" as const);
      const agentRes = await master.generate(
        "System: You are a premium agency business consultant speaking to a non-technical user. " +
        "Use plain language. Avoid technical jargon. Explain what happens next in simple terms.",
        { 
          requestContext,
          memory: mastraMemory,
        }
      );
      const agentText = String((agentRes as any)?.text ?? "").trim();

      return NextResponse.json({
        text: agentText || "Great — now pick a storyboard so we lock the story before design.",
        journey: nextJourney,
        toolUi: storyboardToolUi,
        vibeContext: { ...(vibeContext ?? {}), skillMD },
        progress: { show: true, currentStep: 2 },
      });
    }

    // ------------------------------------------------------------------
    // ACTION: outcome help me decide (deep lane, max 2 questions)
    // ------------------------------------------------------------------
    if (isAction(userMessage) && userMessage === "__ACTION__:outcome_help_me_decide") {
      const deepLaneJourney = {
        ...journey,
        mode: "recommend",
        deepLane: {
          step: 1,
          answers: {},
        },
      };

      const workflowName = String(vibeContext?.displayName ?? vibeContext?.externalId ?? "").trim();

      const mastra = getMastra();
      const master = mastra.getAgent("masterRouterAgent" as const);
      const agentRes = await master.generate(
        [
          "System: Deep lane start. User clicked 'I'm not sure, help me decide'.",
          workflowName ? `System: User's workflow: "${workflowName}".` : "",
          "",
          "TONE: Supportive consultant (not pushy)",
          "",
          "OUTPUT STRUCTURE:",
          "1. Acknowledge: 'No problem! Let me help you figure this out.' (1 sentence)",
          "2. Ask ONE question: What's your main goal - to prove results to a client (retention), or to sell access as a product?",
          "",
          "EXAMPLE:",
          "No problem! Quick question: is this mainly to prove results to a client and help with renewals, or to sell access to the workflow as a product?",
          "",
          NO_ROADMAP_RULES,
        ].filter(Boolean).join("\n"),
        { 
          requestContext,
          memory: mastraMemory,
        }
      );
      const agentText = String((agentRes as any)?.text ?? "").trim();


      return NextResponse.json({
        text: agentText || "No problem! Quick question: is this mainly to prove results to a client (retention dashboard), or to sell access as a product?",
        journey: deepLaneJourney,
        toolUi: null, // ← CHANGED: Don't show cards during deep lane questions
        vibeContext: { ...(vibeContext ?? {}), skillMD },
        progress: { show: false },
      });
    }

    // ------------------------------------------------------------------
    // MODE: consultation (error recovery / deep consultation)
    // ------------------------------------------------------------------
    if (effectiveMode === "consultation") {
      // Agent is in error recovery/consultation mode
      const mastra = getMastra();
      const master = mastra.getAgent("masterRouterAgent" as const);
      
      const consultRes = await master.generate(
        "User encountered an issue. Provide helpful, consultative guidance to understand their needs and continue the dashboard design process naturally.",
        { requestContext, memory: mastraMemory }
      );
      
      return NextResponse.json({
        text: String((consultRes as any)?.text ?? "").trim(),
        journey: { ...journey, mode: "consultation" },
        toolUi: null,
        vibeContext: { ...(vibeContext ?? {}), skillMD },
        progress: { show: false },
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
      const bundlesResult = await callTool(
        getStyleBundles,
        {
          platformType,
          outcome: mapOutcomeToStyleType(journey?.selectedOutcome),
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "User selected a bundle; return the same set for token extraction.",
        }, // inputData
        { requestContext } // context
      );

      const bundle = bundlesResult.bundles.find((b: any) => b.id === selectedId);
      if (!bundle) {
        return NextResponse.json({ error: "STYLE_BUNDLE_NOT_FOUND" }, { status: 400 });
      }

      // Store selected bundle in journey and proceed
      return NextResponse.json({
        text: `Locked in: **${bundle.name}** (${bundle.palette.name}). Generating your preview now...`,
        journey: { ...journey, selectedStyleBundleId: selectedId, mode: "build_preview" },
        toolUi: null,
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Action Handlers
    // ------------------------------------------------------------------

    if (isAction(userMessage) && userMessage.startsWith("__ACTION__:select_storyboard:")) {
      const storyboardId = userMessage.replace("__ACTION__:select_storyboard:", "").trim();
      if (!storyboardId) {
        return NextResponse.json({ error: "MISSING_STORYBOARD_ID" }, { status: 400 });
      }

      const nextJourney = { ...journey, selectedStoryboard: storyboardId, mode: "style" };

      const bundlesResult = await callTool(
        getStyleBundles,
        {
          platformType,
          outcome: mapOutcomeToStyleType(nextJourney?.selectedOutcome),
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "Return premium style+palette bundles appropriate for agency white-label client delivery.",
        }, // inputData
        { requestContext } // context
      );

      return NextResponse.json({
        text: "Perfect. Now choose a style bundle (required) so your preview looks premium immediately.",
        journey: nextJourney,
        toolUi: {
          type: "style_bundles",
          title: "Choose your dashboard style",
          bundles: bundlesResult.bundles.map((b: any) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            previewImageUrl: b.previewImageUrl,
            palette: b.palette,
            tags: b.tags,
          })),
        },
        debug: { sources: bundlesResult.sources },
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Phase: select_entity
    // ------------------------------------------------------------------
    if (effectiveMode === "select_entity") {
      return NextResponse.json({
        text:
          "Phase 0 happens in /control-panel/chat. Select a workflow there first, then come back to /vibe/chat.",
        journey: { ...journey, mode: "select_entity" },
        toolUi: null,
      });
    }

    // ------------------------------------------------------------------
    // Phase: recommend (Phase 1 — platform-specific outcomes)
    // ------------------------------------------------------------------
    if (effectiveMode === "recommend") {
      // Get platform-specific outcomes from catalog
      const outcomesResult = (await callTool(
        getOutcomes,
        { platformType },
        { requestContext }
      )) as GetOutcomesResult;

      // Filter to 2 core outcomes: dashboard and product only
      type OutcomeType = GetOutcomesResult['outcomes'][number];
      
      const dashboardOutcome = outcomesResult.outcomes.find(o => o.category === 'dashboard');
      const productOutcome = outcomesResult.outcomes.find(o => o.category === 'product');
      
      // TypeScript-safe filtering: remove undefined values
      const coreOutcomes = [dashboardOutcome, productOutcome].filter(
        (o): o is OutcomeType => o !== undefined && o !== null
      );
      
      const toolUi: ToolUi = {
        type: "outcome_cards",
        title: "Outcome + Monetization Strategy",
        options: coreOutcomes.map((o) => ({
          id: o.id,
          title: o.name,
          description: o.description,
          previewImageUrl: o.previewImageUrl,
          tags: o.tags,
        })),
      };

      const workflowName = String(vibeContext?.displayName ?? vibeContext?.externalId ?? "").trim();

      const mastra = getMastra();
      const master = mastra.getAgent("masterRouterAgent" as const);
      const agentRes = await master.generate(
        [
          "System: Phase 1 outcome selection. You are a premium business consultant.",
          workflowName ? `System: User's workflow name: "${workflowName}".` : "",
          "",
          "TONE REQUIREMENTS:",
          "- Warm and consultative (not robotic)",
          "- Use plain business language",
          "- Reference the workflow naturally in context",
          "- Make the user feel understood",
          "",
          "OUTPUT STRUCTURE (exactly 4 parts):",
          "1. Greeting: 'Hey! I see you're working with [workflow name/type].'",
          "2. Recommendation: 'I recommend starting with a [Dashboard/Product].'",
          "3. Reasons: Exactly 2 bullet points explaining WHY (tie to the workflow's purpose)",
          "4. CTA: 'Pick one of the cards below, or click \"I'm not sure\" if you want help deciding.'",
          "",
          "EXAMPLE:",
          "Hey! I see you're working with your WooCommerce Support Agent.",
          "",
          "I recommend starting with a **Dashboard**.",
          "",
          "• It will help you easily track how well your support agent is handling customer queries",
          "• You'll be able to quickly identify any issues and improve response times",
          "",
          "Pick one of the cards below, or click \"I'm not sure\" if you want help deciding.",
          "",
          NO_ROADMAP_RULES,
        ].filter(Boolean).join("\n"),
        { 
          requestContext,
          memory: mastraMemory,
        }
      );
      const agentText = String((agentRes as any)?.text ?? "").trim();

      // Check if user is in deep lane (consultative mode)
      const inDeepLane = Boolean(journey?.deepLane);
      
      return NextResponse.json({
        text: agentText || "Hey! Let's figure out what you want to build first. Pick one of the cards below, or click \"I'm not sure\" if you want help deciding.",
        journey: { ...journey, mode: "recommend" },
        toolUi: inDeepLane ? null : toolUi, // Suppress cards in deep lane
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Phase: align (Phase 2 — storyboard cards)
    // ------------------------------------------------------------------
    if (effectiveMode === "align") {
      const toolUi: ToolUi = {
        type: "storyboard_cards",
        title: "Choose your KPI Storyboard",
        options: [
          {
            id: "roi_proof",
            title: "ROI Proof (Client-facing)",
            description: "Prove automation value and time saved to drive renewals.",
            kpis: dedupeStringsByMetricId(["Tasks automated", "Time saved", "Success rate", "Executions over time", "Most recent runs"]),
          },
          {
            id: "reliability_ops",
            title: "Reliability Ops (Agency-facing)",
            description: "Operate and debug reliability across workflows quickly.",
            kpis: dedupeStringsByMetricId(["Failure count", "Success rate", "Recent errors", "Avg runtime", "Slowest runs"]),
          },
          {
            id: "delivery_sla",
            title: "Delivery / SLA (Client-facing)",
            description: "Show delivery health and turnaround time trends.",
            kpis: dedupeStringsByMetricId(["Runs completed", "Avg turnaround time", "Incidents this week", "Last successful run", "Status trend"]),
          },
        ],
      };

      const workflowName = String(vibeContext?.displayName ?? vibeContext?.externalId ?? "").trim();

      const mastra = getMastra();
      const master = mastra.getAgent("masterRouterAgent" as const);
      const agentRes = await master.generate(
        [
          "System: Phase 2 storyboard selection (KPI story).",
          workflowName ? `System: Selected workflow name: "${workflowName}".` : "",
          NO_ROADMAP_RULES,
          "Output requirements:",
          "- 1 sentence: 'Now we pick the story this will tell.'",
          "- Recommend ONE storyboard by name (ROI Proof vs Reliability Ops vs Delivery/SLA) with 1 short reason.",
          "- Do NOT list metrics (the cards already show them).",
        ].filter(Boolean).join("\n"),
        { 
          requestContext,
          memory: mastraMemory,
        }
      );
      const agentText = String((agentRes as any)?.text ?? "").trim();

      return NextResponse.json({
        text: agentText || "Now let's pick the story this will tell. Choose the option that matches what you want to prove first.",
        journey: { ...journey, mode: "align" },
        toolUi,
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Phase: style (RAG -> 4 bundles)
    // ------------------------------------------------------------------
    if (effectiveMode === "style") {
      const bundlesResult = await callTool(
        getStyleBundles,
        {
          platformType,
          outcome: mapOutcomeToStyleType(journey?.selectedOutcome),
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "Return premium style+palette bundles appropriate for agency white-label client delivery.",
        }, // inputData
        { requestContext } // context
      );

      return NextResponse.json({
        text: "Choose a style bundle (required). This sets the look + palette so the preview feels sellable immediately.",
        journey: { ...journey, mode: "style" },
        toolUi: {
          type: "style_bundles",
          title: "Choose your dashboard style",
          bundles: bundlesResult.bundles.map((b: any) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            previewImageUrl: b.previewImageUrl,
            palette: b.palette,
            tags: b.tags,
          })),
        },
        debug: { sources: bundlesResult.sources },
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Phase: build_preview (delegate to platformMappingMaster for real preview)
    // ------------------------------------------------------------------
    if (effectiveMode === "build_preview") {
      let interfaceId = vibeContext?.interfaceId as string | undefined;

      if (!interfaceId) {
        // Trigger preview generation via existing agent orchestrator.
        // This must return interfaceId + previewUrl + versionId, or at minimum previewUrl + versionId.
        const previewRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/agent/master`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            userId,
            message: "Generate preview dashboard now.",
            platformType,
            sourceId,
          }),
        });

        const previewJson = await previewRes.json().catch(() => ({}));

        if (!previewRes.ok || previewJson?.type === "error") {
          return NextResponse.json(
            { error: previewJson?.message || "PREVIEW_GENERATION_FAILED" },
            { status: 500 }
          );
        }

        // Attempt to extract preview outputs (must match your existing /api/agent/master response)
        const previewUrl = String(previewJson?.previewUrl ?? previewJson?.result?.previewUrl ?? "");
        const newInterfaceId = String(previewJson?.interfaceId ?? previewJson?.result?.interfaceId ?? "");
        const newVersionId = String(previewJson?.versionId ?? previewJson?.result?.versionId ?? "");

        if (!newInterfaceId) {
          return NextResponse.json(
            { error: "PREVIEW_GENERATION_DID_NOT_RETURN_INTERFACE_ID" },
            { status: 500 }
          );
        }

        interfaceId = newInterfaceId;

        // Merge into vibeContext for subsequent steps
        const nextVibeContext = {
          ...(vibeContext ?? {}),
          interfaceId: newInterfaceId,
          previewUrl: previewUrl || null,
          previewVersionId: newVersionId || null,
          skillMD,
        };

        // Continue build_preview using the newly created interfaceId
        vibeContext.interfaceId = newInterfaceId;
        vibeContext.previewUrl = previewUrl || null;
        vibeContext.previewVersionId = newVersionId || null;
      }

      // Load the actual current spec to extract real component IDs for interactive edit.
      const current = await callTool(
        getCurrentSpec,
        { interfaceId }, // inputData - tenantId removed as it's not needed
        { requestContext } // context
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
        vibeContext: { ...(vibeContext ?? {}), skillMD, interfaceId, previewUrl: vibeContext?.previewUrl ?? null, previewVersionId: vibeContext?.previewVersionId ?? null },
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
          const currentSpecForPalette = await callTool(
            getCurrentSpec,
            { interfaceId: payload.interfaceId },  // FIXED: Direct parameters, no tenantId
            { requestContext }
          );
          
          await callTool(
            applySpecPatch,
            { 
              spec_json: currentSpecForPalette.spec_json,
              design_tokens: currentSpecForPalette.design_tokens,
              operations: [
                { op: "setDesignToken", tokenPath: "theme.color.primary", tokenValue: p.primary },
                { op: "setDesignToken", tokenPath: "theme.color.accent", tokenValue: p.accent },
                { op: "setDesignToken", tokenPath: "theme.color.background", tokenValue: p.background },
                { op: "setDesignToken", tokenPath: "theme.color.surface", tokenValue: p.surface },
                { op: "setDesignToken", tokenPath: "theme.color.text", tokenValue: p.text },
              ],
            },  // FIXED: Direct parameters
            { requestContext }
          );
        }
      }

      const result = await callTool(
        applyInteractiveEdits,
        { 
          tenantId,
          userId,
          interfaceId: payload.interfaceId,
          platformType,
          actions: actions,
        },  // FIXED: Direct parameters, not wrapped
        { requestContext }
      );

      return NextResponse.json({
        text: "Done — your preview has been updated.",
        journey: { ...journey, mode: "interactive_edit" },
        toolUi: null,
        previewUrl: result.previewUrl,
        previewVersionId: result.previewVersionId,
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // Default fallback: process user message with router agent
    const mastra = getMastra();
    const master = mastra.getAgent("masterRouterAgent" as const);
    const result = await master.generate(userMessage, {
      maxSteps: 3,
      requestContext,
      memory: mastraMemory,
    });

    const agentText = String((result as any)?.text ?? "").trim();

    return NextResponse.json({
      text: agentText || "I'm ready. Tell me what you want to do next.",
      journey,
      toolUi: null,
      vibeContext: { ...(vibeContext ?? {}), skillMD },
    });
  } catch (err: any) {
    const errorMessage = String(err?.message || "UNKNOWN_ROUTER_ERROR");
    const stack = typeof err?.stack === "string" ? err.stack : undefined;

    // Log to Vercel for immediate visibility
    console.error("[api/vibe/router] error", {
      message: errorMessage,
      stack,
      name: err?.name,
      code: err?.code,
      cause: err?.cause,
    });

    // Get workflow name from request body if vibeContext is not available in catch scope
    const body = await req.clone().json().catch(() => ({}));
    const workflowName = String(body?.vibeContext?.displayName ?? body?.vibeContext?.externalId ?? "").trim();
    
    // Agent provides consultative error response
    const mastra = getMastra();
    const master = mastra.getAgent("masterRouterAgent" as const);
    
    // Create proper RequestContext instance for agent
    const errorRequestContext = new RequestContext();
    errorRequestContext.set("userId", body?.userId || "unknown");
    errorRequestContext.set("tenantId", body?.tenantId || "unknown");
    errorRequestContext.set("platformType", body?.vibeContext?.platformType || "other");
    errorRequestContext.set("phase", "consultation");
    if (body?.vibeContext?.sourceId) {
      errorRequestContext.set("sourceId", body.vibeContext.sourceId);
    }
    if (workflowName) {
      errorRequestContext.set("workflowName", workflowName);
    }
    
    const agentErrorRes = await master.generate(
      `System: Backend error occurred: ${errorMessage}. 
       User context: ${workflowName ? `Workflow: ${workflowName}` : 'No workflow selected'}
       Current phase: 'consultation'
       
       CRITICAL: Do NOT mention technical errors or "request failed".
       Instead, provide helpful consulting to keep the user engaged.
       Ask questions or show fallback options to continue the journey naturally.`,
      { 
        requestContext: errorRequestContext, 
        memory: {
          resource: String(body?.userId || "unknown"),
          thread: String(body?.threadId || "error-thread")
        }
      }
    );
    
    const agentText = String((agentErrorRes as any)?.text ?? "").trim();
    
    return NextResponse.json({
      text: agentText || "Let me help you work through this. What would you like to achieve with your dashboard?",
      journey: { ...(body?.journey ?? {}), mode: "consultation" }, // Enter consultative mode
      toolUi: null, // No cards during error recovery
      vibeContext: { ...(body?.vibeContext ?? {}) },
      progress: { show: false }, // Hide progress during consultation
    });
  }
}


