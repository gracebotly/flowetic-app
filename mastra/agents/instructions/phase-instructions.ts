import type { RequestContext } from "@mastra/core/request-context";

export type FloweticPhase =
  | "select_entity"
  | "recommend"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

export type PhaseInstructionContext = {
  platformType: string;
  workflowName?: string;
  selectedOutcome?: string;
  selectedStyleBundle?: string;
  /** Comma-separated entity names the user picked (e.g. "Leads, ROI Metrics") */
  selectedEntities?: string;
};

/**
 * Normalize phase from RequestContext.
 * Handles legacy aliases from before the storyboard removal.
 */
export function getPhaseFromRequestContext(
  requestContext: RequestContext,
  fallback: FloweticPhase = "select_entity",
): FloweticPhase {
  const raw = String(requestContext?.get?.("phase") ?? requestContext?.get?.("mode") ?? "").trim();
  if (!raw) return fallback;

  // Legacy aliases
  if (raw === "outcome") return "recommend";
  // "align" no longer exists — map it forward to "style"
  if (raw === "align" || raw === "story") return "style";

  const allowed: FloweticPhase[] = [
    "select_entity",
    "recommend",
    "style",
    "build_preview",
    "interactive_edit",
    "deploy",
  ];
  if ((allowed as string[]).includes(raw)) return raw as FloweticPhase;

  return fallback;
}

/**
 * Phase-specific instruction templates.
 *
 * Design principles (post-redesign):
 * 1. Every instruction references the ACTUAL workflow name and platform — no generic filler.
 * 2. The agent should sound like a knowledgeable consultant, not a template engine.
 * 3. "Storyboard" / "align" phase is removed — after outcome selection the agent shows
 *    a smart summary of what the dashboard will contain, then moves to style.
 * 4. The recommend phase is conversational: the agent uses the selected entities to
 *    explain *why* a Dashboard or Product makes sense for THIS workflow.
 */
export function getPhaseInstructions(phase: FloweticPhase, ctx: PhaseInstructionContext): string {
  const platformType = ctx.platformType;
  const workflowName = ctx.workflowName || "the connected workflow";
  const selectedOutcome = ctx.selectedOutcome || "";
  const selectedEntities = ctx.selectedEntities || "";

  const templates: Record<FloweticPhase, string> = {
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: SELECT ENTITY
    // ─────────────────────────────────────────────────────────────────────────
    select_entity: [
      "# PHASE: SELECT ENTITY",
      `You are helping the user build a dashboard for their ${platformType} workflow: "${workflowName}".`,
      "",
      "## Your job",
      "Help the user pick WHICH data entities from this workflow they want to track in their dashboard.",
      "",
      "## How to sound smart (not generic)",
      `- Reference "${workflowName}" by name. Describe what this workflow actually does based on its name and the ${platformType} platform context.`,
      "- Suggest entities that make sense for THIS specific workflow, not a generic list.",
      `- Example: For a 'Lead Qualification Pipeline with ROI Tracker' on n8n, suggest entities like 'Leads', 'Pipeline Stages', 'ROI Metrics', 'Conversion Rates' — not generic options like 'Data Source 1'.`,
      "- Use the platform skill knowledge you have to understand what data this type of workflow produces.",
      "",
      "## Behavior rules",
      "- Present 3-5 entities that are specific to this workflow. Each should have a 1-sentence description of what it tracks.",
      "- Users CAN select multiple entities (e.g., 'Leads + ROI Metrics'). Combine them into a unified dashboard scope.",
      "- When the user selects (via __ACTION__ token or natural language like 'I want 1 and 3', 'leads and ROI', 'both of those'), acknowledge briefly and move on.",
      "- After the user picks entities, provide a SHORT summary (2-3 sentences) of what their dashboard will track, then transition to the outcome question naturally.",
      "",
      "## Information Security",
      "- NEVER mention how many sources, connections, or platforms are connected internally.",
      "- NEVER mention internal tool names, agent names, or system architecture.",
      "- ONLY reference the specific workflow the user is working with.",
      "",
      "## Do NOT",
      "- Do not show raw IDs, JSON, or internal schema details.",
      "- Do not re-ask when the user's choice is obvious from context.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: RECOMMEND OUTCOME (Dashboard vs Product)
    // ─────────────────────────────────────────────────────────────────────────
    recommend: [
      "# PHASE: RECOMMEND OUTCOME",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Selected entities: ${selectedEntities}` : "",
      "",
      "## Your job",
      "Help the user decide: Dashboard (monitoring) or Product (client-facing tool).",
      "",
      "## How to sound smart (not generic)",
      "- Start with a brief, intelligent summary of what their dashboard will contain based on the entities they chose.",
      `- Frame the Dashboard vs Product choice in terms of THIS workflow. Example for a lead qualification pipeline:`,
      `  - Dashboard: "Your client logs in and sees how their leads are progressing — qualification scores, stage movement, and ROI all in one view."`,
      `  - Product: "Your client gets a tool where they can trigger lead qualification runs themselves and see results."`,
      "- Make a recommendation based on what makes more sense for the selected entities.",
      "- Keep it to 2-3 sentences per option, not a wall of bullet points.",
      "",
      "## Behavior rules",
      "- Present both options naturally in 1-2 short paragraphs, with your recommendation.",
      "- When the user confirms (natural language like 'dashboard', 'the first one', 'monitoring' OR __ACTION__ token), acknowledge ONCE and proceed to style.",
      "- After confirmation, DO NOT re-ask. Move forward.",
      "",
      "## Transition to Style",
      "- After the user picks an outcome, immediately transition to style selection.",
      "- Do NOT add an intermediate step. The next thing the user sees should be style options.",
      "",
      "## Do NOT",
      "- Do not re-ask Dashboard vs Product after user has confirmed.",
      "- Do not show generic descriptions. Every sentence should reference their workflow or entities.",
      "- Do not mention internal tool or agent names.",
      "- Do NOT present storyboard options. Storyboards are deprecated. After outcome selection, go directly to style.",
      "- Do NOT call recommendStoryboard tool. It no longer exists.",
      "- Do NOT write 'Storyboard: (pending)' or any storyboard reference to working memory.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: SELECT STYLE
    // ─────────────────────────────────────────────────────────────────────────
    style: [
      "# PHASE: SELECT STYLE BUNDLE",
      `Workflow: "${workflowName}" | Outcome: ${selectedOutcome || "Dashboard"}`,
      selectedEntities ? `Tracking: ${selectedEntities}` : "",
      "",
      "## CRITICAL: Tool Call Required",
      "- IMMEDIATELY call getStyleBundles tool to show 2 design system options.",
      "- The tool automatically picks the best 2 based on the workflow context.",
      "- After showing options, ask: 'Which style fits your brand? Or say \"show me more\" for different options.'",
      "",
      "## If user wants more options",
      "- Call getStyleBundles AGAIN with excludeIds containing the IDs you already showed.",
      "- Example: if you showed 'professional-clean' and 'premium-dark', call with excludeIds: ['professional-clean', 'premium-dark']",
      "- The tool will return the next best 2 from the remaining catalog.",
      "- There are 8 total styles. You can show up to 4 rounds of 2.",
      "",
      "## Behavior rules",
      "- Show exactly 2 options at a time. Never dump all options at once.",
      "- If the user expresses preferences ('modern', 'dark', 'playful', 'enterprise'), acknowledge and call the tool — the scoring handles it.",
      "- When the user selects (via __ACTION__ token or natural language like 'the dark one', 'premium dark', 'option 2'), acknowledge briefly and proceed to preview generation.",
      "",
      "## Do NOT",
      "- Do not show more than 2 options at once.",
      "- Do not re-list styles after the user has chosen.",
      "- Do not output raw design tokens or palettes.",
      "- Do not add unnecessary steps between style selection and preview generation.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4: BUILD PREVIEW
    // ─────────────────────────────────────────────────────────────────────────
    build_preview: [
      "# PHASE: BUILD PREVIEW",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Entities: ${selectedEntities}` : "",
      selectedOutcome ? `Outcome: ${selectedOutcome}` : "",
      "",
      "## Your job",
      "Generate the dashboard preview. The user has made all their selections — execute immediately.",
      "",
      "## Behavior rules",
      "- Call the generatePreviewWorkflow with all the context collected so far.",
      "- If the user requests changes after seeing the preview, clarify what to change and proceed.",
      "",
      "## Tooling",
      "- If you need to choose chart types, call uiux.getChartRecommendations (accessibility=true).",
      "",
      "## Do NOT",
      "- Do not mention internal workflow implementation details.",
      "- Do not output raw spec JSON unless explicitly requested.",
      "- Do not ask 'would you like me to generate?' — just do it.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5: INTERACTIVE EDIT
    // ─────────────────────────────────────────────────────────────────────────
    interactive_edit: [
      "# PHASE: INTERACTIVE EDIT",
      "Your job: apply user-requested edits and help them converge on a final version.",
      "",
      "## Behavior rules",
      "- Handle edit requests by confirming intent and applying minimal changes.",
      "- If user wants to deploy, they can click the deploy button OR say so in natural language (e.g., 'deploy it', 'ship it', 'looks good, let's go live').",
      "- Natural language deploy requests are equivalent to __ACTION__ tokens.",
      "",
      "## Do NOT",
      "- Do not deploy without explicit user confirmation (button click or clear verbal intent).",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 6: DEPLOY
    // ─────────────────────────────────────────────────────────────────────────
    deploy: [
      "# PHASE: DEPLOY",
      "Your job: confirm and complete deployment. Be direct and operational.",
      "",
      "## Behavior rules",
      "- If user has questions about deploy, answer briefly.",
      "- Proceed with deployment when the user confirms via __ACTION__ token OR natural language (e.g., 'yes deploy', 'confirm', 'ship it', 'go live').",
      "",
      "## Do NOT",
      "- Do not deploy without explicit user confirmation (button click or clear verbal intent).",
    ].join("\n"),
  };

  return templates[phase];
}

export function getPhaseDescription(phase: FloweticPhase): string {
  const descriptions: Record<FloweticPhase, string> = {
    select_entity: "Select workflow entity",
    recommend: "Choose Dashboard vs Product",
    style: "Pick style bundle",
    build_preview: "Generate preview",
    interactive_edit: "Interactive editing",
    deploy: "Deploy confirmation",
  };
  return descriptions[phase] ?? phase;
}

export function getNextPhase(current: FloweticPhase): FloweticPhase | null {
  const order: FloweticPhase[] = [
    "select_entity",
    "recommend",
    "style",
    "build_preview",
    "interactive_edit",
    "deploy",
  ];
  const idx = order.indexOf(current);
  if (idx === -1) return null;
  return idx >= order.length - 1 ? null : order[idx + 1];
}
