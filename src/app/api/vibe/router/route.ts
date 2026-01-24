

import { NextRequest, NextResponse } from "next/server";
// import { RequestContext } from "@mastra/core/request-context"; // Removed - invalid import
import { createClient } from "@/lib/supabase/server";
import { loadSkill } from "@/mastra/skills/loadSkill";
import { z } from "zod";

import { designAdvisorAgent } from "@/mastra/agents/designAdvisorAgent";

import { dashboardBuilderAgent } from "@/mastra/agents/dashboardBuilderAgent";
import { masterRouterAgent } from "@/mastra/agents/masterRouterAgent";

import { todoAdd, todoList } from "@/mastra/tools/todo";
import { getStyleBundles } from "@/mastra/tools/design/getStyleBundles";
import { applyInteractiveEdits } from "@/mastra/tools/interactiveEdit";
import { getCurrentSpec, applySpecPatch } from "@/mastra/tools/specEditor";
import { callTool } from "@/mastra/lib/callTool";

// Agent response schemas using Zod
const AgentDecisionSchema = z.object({
  action: z.enum(['show_cards', 'ask_question', 'proceed']).describe('What the agent wants to do next'),
  phase: z.enum(['recommend', 'align', 'style', 'build_preview', 'interactive_edit']).optional().describe('If showing cards, which phase'),
  question: z.string().optional().describe('If asking a question, what to ask'),
  reasoning: z.string().optional().describe('Why this action was chosen'),
});

type AgentDecision = z.infer<typeof AgentDecisionSchema>;

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

type ToolUi =
  | {
      type: "outcome_cards";
      title: string;
      options: Array<{ id: "dashboard" | "product"; title: string; description: string }>;
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

    // Thread id: use vibeContextSnapshot/thread id if you have it; fallback to "vibe"
    const threadId = vibeContext?.threadId || "vibe";
    (runtimeContext as any).threadId = threadId;

    // Add context properties to runtimeContext object
    const workflowName = String(vibeContext?.displayName ?? vibeContext?.externalId ?? "").trim();
    if (workflowName) (runtimeContext as any).workflowName = workflowName;
    if (vibeContext?.entityId) (runtimeContext as any).workflowEntityId = String(vibeContext.entityId);
    if (vibeContext?.sourceId) (runtimeContext as any).sourceId = String(vibeContext.sourceId);
    if (journey?.selectedOutcome) (runtimeContext as any).selectedOutcome = String(journey.selectedOutcome);
    if (journey?.selectedStoryboard) (runtimeContext as any).selectedStoryboard = String(journey.selectedStoryboard);

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

        const agentRes = await masterRouterAgent.generate(
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
          { requestContext: runtimeContext }
        );
        const agentText = String((agentRes as any)?.text ?? "").trim();

        return NextResponse.json({
          text: agentText || "Got it. One more quick question: who will mainly use this — your team, or client?",
          journey: nextJourney,
          toolUi: null, // KEEP cards hidden during deep lane
          vibeContext: { ...(vibeContext ?? {}), skillMD },
        });
      }

      if (deepLaneStep === 2) {
        // Deep lane complete: user answered both questions
        const answers = journey?.deepLane?.answers ?? {};
        
        // Agent generates final recommendation
        const agentRes = await masterRouterAgent.generate(
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
          { requestContext: runtimeContext }
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
              kpis: ["Tasks automated", "Time saved", "Success rate", "Executions over time", "Most recent runs"],
            },
            {
              id: "reliability_ops",
              title: "Reliability Ops (Agency-facing)",
              description: "Operate and debug reliability across workflows quickly.",
              kpis: ["Failure count", "Success rate", "Recent errors", "Avg runtime", "Slowest runs"],
            },
            {
              id: "delivery_sla",
              title: "Delivery / SLA (Client-facing)",
              description: "Show delivery health and turnaround time trends.",
              kpis: ["Runs completed", "Avg turnaround time", "Incidents this week", "Last successful run", "Status trend"],
            },
          ],
        };

        return NextResponse.json({
          text: agentText || "Based on your answers, I recommend starting with a Dashboard. Now let's pick the story this will tell.",
          journey: nextJourney,
          toolUi,
          vibeContext: { ...(vibeContext ?? {}), skillMD },
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

      if (outcome !== "dashboard" && outcome !== "product") {
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
            kpis: ["Tasks automated", "Time saved", "Success rate", "Executions over time", "Most recent runs"],
          },
          {
            id: "reliability_ops",
            title: "Reliability Ops (Agency-facing)",
            description: "Operate and debug reliability across workflows quickly.",
            kpis: ["Failure count", "Success rate", "Recent errors", "Avg runtime", "Slowest runs"],
          },
          {
            id: "delivery_sla",
            title: "Delivery / SLA (Client-facing)",
            description: "Show delivery health and turnaround time trends.",
            kpis: ["Runs completed", "Avg turnaround time", "Incidents this week", "Last successful run", "Status trend"],
          },
        ],
      };

      // Agent-driven user-facing text, skill-aware with plain language
      const agentInput = actionToAgentHint(userMessage);
      const agentRes = await masterRouterAgent.generate(
        "System: You are a premium agency business consultant speaking to a non-technical user. " +
        "Use plain language. Avoid technical jargon. Explain what happens next in simple terms.",
        { requestContext: runtimeContext }
      );
      const agentText = String((agentRes as any)?.text ?? "").trim();

      return NextResponse.json({
        text: agentText || "Great — now pick a storyboard so we lock the story before design.",
        journey: nextJourney,
        toolUi: storyboardToolUi,
        vibeContext: { ...(vibeContext ?? {}), skillMD },
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

      const agentRes = await masterRouterAgent.generate(
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
        { requestContext: runtimeContext }
      );
      const agentText = String((agentRes as any)?.text ?? "").trim();


      return NextResponse.json({
        text: agentText || "No problem! Quick question: is this mainly to prove results to a client (retention dashboard), or to sell access as a product?",
        journey: deepLaneJourney,
        toolUi: null, // ← CHANGED: Don't show cards during deep lane questions
        vibeContext: { ...(vibeContext ?? {}), skillMD },
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
          outcome: journey?.selectedOutcome ?? "dashboard",
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "User selected a bundle; return the same set for token extraction.",
        }, // inputData
        { requestContext: runtimeContext } // context
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
          outcome: nextJourney?.selectedOutcome ?? "dashboard",
          audience: "client",
          dashboardKind: "workflow-activity",
          notes: "Return premium style+palette bundles appropriate for agency white-label client delivery.",
        }, // inputData
        { requestContext: runtimeContext } // context
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
    // Phase: recommend (Phase 1 — outcome recommendation with agent decision)
    // ------------------------------------------------------------------
    if (effectiveMode === "recommend" && !journey?.selectedOutcome) {
      // Let agent decide: show cards now, or ask clarifying questions first?
      const decision = await masterRouterAgent.generate(
        [
          enhancedSystemPrompt,
          "",
          "TASK: Decide if you have enough information to recommend dashboard vs product.",
          "If you're confident, respond with action='show_cards' and phase='recommend'.",
          "If you need more info, respond with action='ask_question' and provide the question.",
          "",
          `User message: ${userMessage}`,
        ].join("\n"),
        {
          structuredOutput: {
            schema: AgentDecisionSchema,
          },
        }
      );

      const agentDecision = decision.object as AgentDecision;

      // Agent wants to ask questions first
      if (agentDecision.action === 'ask_question') {
        return NextResponse.json({
          text: agentDecision.question || "Can you tell me more about who will use this dashboard?",
          journey: { ...journey, mode: "recommend" },
          toolUi: null, // No cards yet
          vibeContext: { ...(vibeContext ?? {}), skillMD },
        });
      }

      // Agent is confident - generate outcome cards response
      const cardsResponse = await masterRouterAgent.generate(
        [
          enhancedSystemPrompt,
          "",
          "TASK: Explain why you're recommending dashboard or product.",
          "Be consultative and reference the workflow's actual capabilities.",
          "",
          NO_ROADMAP_RULES,
        ].join("\n"),
        {
          requestContext: runtimeContext,
        }
      );

      return NextResponse.json({
        text: cardsResponse.text,
        journey: { ...journey, mode: "recommend" },
        toolUi: {
          type: "outcome_cards",
          title: "Choose your dashboard type",
          options: [
            {
              id: "dashboard",
              title: "Client ROI Dashboard",
              description: "Prove value to clients with clear metrics and ROI tracking",
            },
            {
              id: "product",
              title: "Workflow Product",
              description: "Turn your automation into a standalone product experience",
            },
          ],
        },
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Phase: align (Phase 2 — storyboard alignment with agent decision)
    // ------------------------------------------------------------------
    if (effectiveMode === "align" && !journey?.selectedStoryboard) {
      const selectedOutcome = journey?.selectedOutcome || "dashboard";

      // Let agent decide if ready to show storyboards
      const decision = await masterRouterAgent.generate(
        [
          enhancedSystemPrompt,
          "",
          `User selected: ${selectedOutcome}`,
          "TASK: Decide if you're ready to recommend a visual story style.",
          "If confident, respond with action='show_cards' and phase='align'.",
          "If you need workflow clarification, respond with action='ask_question'.",
          "",
          `User message: ${userMessage}`,
        ].join("\n"),
        {
          structuredOutput: {
            schema: AgentDecisionSchema,
          },
        }
      );

      const agentDecision = decision.object as AgentDecision;

      if (agentDecision.action === 'ask_question') {
        return NextResponse.json({
          text: agentDecision.question || "What metrics are most important to track in this workflow?",
          journey: { ...journey, mode: "align" },
          toolUi: null,
          vibeContext: { ...(vibeContext ?? {}), skillMD },
        });
      }

      // Agent ready - generate storyboard recommendation
      const cardsResponse = await masterRouterAgent.generate(
        [
          enhancedSystemPrompt,
          "",
          "TASK: Recommend a visual story style based on the workflow's purpose.",
          "Explain which style fits best and why.",
          "",
          NO_ROADMAP_RULES,
        ].join("\n"),
        {
          requestContext: runtimeContext,
        }
      );

      return NextResponse.json({
        text: cardsResponse.text,
        journey: { ...journey, mode: "align" },
        toolUi: {
          type: "storyboard_cards",
          title: "Choose your visual story",
          options: [
            {
              id: "roi_proof",
              title: "ROI Proof",
              description: "Focus on cost savings and efficiency gains",
              kpis: ["Cost per call", "Time saved", "Conversion rate"],
            },
            {
              id: "reliability_ops",
              title: "Reliability & Ops",
              description: "Highlight system uptime and operational health",
              kpis: ["Success rate", "Response time", "Error rate"],
            },
            {
              id: "delivery_sla",
              title: "Delivery & SLA",
              description: "Track service delivery and performance commitments",
              kpis: ["Completed tasks", "SLA compliance", "Throughput"],
            },
          ],
        },
        vibeContext: { ...(vibeContext ?? {}), skillMD },
      });
    }

    // ------------------------------------------------------------------
    // Phase: style (Phase 3 — style bundle selection)
    // ------------------------------------------------------------------
    if (effectiveMode === "style" && !journey?.selectedStyleBundle) {
      // Fetch style bundles from tool
      const bundlesResult = await callTool(
        getStyleBundles,
        {},
        { requestContext: runtimeContext }
      );

      // Agent explains style choices
      const styleResponse = await masterRouterAgent.generate(
        [
          enhancedSystemPrompt,
          "",
          "TASK: Briefly explain what each style bundle communicates.",
          "Help the user pick the right visual tone for their client.",
          "",
          NO_ROADMAP_RULES,
        ].join("\n"),
        {
          requestContext: runtimeContext,
        }
      );

      return NextResponse.json({
        text: styleResponse.text,
        journey: { ...journey, mode: "style" },
        toolUi: {
          type: "style_bundles",
          title: "Choose your style",
          bundles: bundlesResult.bundles,
        },
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
        { requestContext: runtimeContext } // context
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

      // Agent explains what user can refine
      const editResponse = await masterRouterAgent.generate(
        [
          enhancedSystemPrompt,
          "",
          "TASK: Explain that the preview is ready and what the user can refine.",
          "Be brief and encouraging.",
          "",
          NO_ROADMAP_RULES,
        ].join("\n"),
        {
          requestContext: runtimeContext,
        }
      );

      return NextResponse.json({
        text: editResponse.text,
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
        vibeContext: {
          ...(vibeContext ?? {}),
          skillMD,
          interfaceId,
          previewUrl: vibeContext?.previewUrl ?? null,
          previewVersionId: vibeContext?.previewVersionId ?? null,
        },
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
            { requestContext: runtimeContext }
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
            { requestContext: runtimeContext }
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
        { requestContext: runtimeContext }
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

    // Default fallback
    return NextResponse.json({
      text: "I'm ready. Tell me what you want to do next.",
      journey,
      toolUi: null,
      vibeContext: { ...(vibeContext ?? {}), skillMD },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "UNKNOWN_ROUTER_ERROR" },
      { status: 500 }
    );
  }
}


