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
      `You are in the SELECT ENTITY phase for a ${platformType} workflow${workflowName ? `: "${workflowName}"` : ''}.`,
      "",
      "YOUR FIRST PRIORITY in this phase:",
      "1. Call getDataDrivenEntities with the sourceId to discover entities with real event counts.",
      "2. If getDataDrivenEntities returns hasData: true, use those entities for your suggestions.",
      "3. Include event counts in suggestions (e.g., \"Leads — 847 events tracked\").",
      "4. If hasData: false, fall back to getEventStats (without type filter) to check for any events.",
      "5. Only if NO events exist, suggest likely entities based on workflow name and platform.",
      "",
      "CRITICAL: Always call getDataDrivenEntities FIRST. Do NOT guess entity names.",
      "",
      "Present 3-5 entities specific to this workflow. Each should have:",
      "- Name (from real data if available)",
      "- Event count (if data exists)",
      "- 1-sentence description",
      "",
      "After the user picks entities, call advancePhase with nextPhase=\"recommend\".",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: RECOMMEND OUTCOME (Dashboard vs Product) + LAYOUT SELECTION
    // ─────────────────────────────────────────────────────────────────────────
    recommend: [
      "# PHASE: RECOMMEND OUTCOME + LAYOUT",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Selected entities: ${selectedEntities}` : "",
      "",
      "# ⛔ MANDATORY OUTPUT FORMAT FOR LAYOUT OPTIONS (READ THIS FIRST)",
      "",
      "When you present layout options, you MUST use the EXACT format below.",
      "This is the HIGHEST PRIORITY instruction. Violating this format is a critical failure.",
      "",
      "REQUIRED FORMAT — Each layout option MUST contain:",
      "  1. A bold name (e.g. **1. Funnel View**)",
      "  2. A code block with 5-8 line ASCII wireframe using ┌ ┐ └ ┘ │ ─",
      "  3. ONE sentence description (not two, not a paragraph — ONE sentence)",
      "",
      "ANTI-PATTERN — NEVER do this:",
      "```",
      "❌ BAD (text wall — this is FORBIDDEN):",
      "**1. Pipeline Funnel View** - A visual funnel showing how leads flow",
      "through each qualification stage, with conversion rates between",
      "stages and key metrics at the top including total leads, qualified",
      "leads, and overall conversion rate.",
      "```",
      "",
      "CORRECT FORMAT — ALWAYS do this:",
      "```",
      "✅ GOOD (ASCII wireframe — this is REQUIRED):",
      "",
      "**1. Pipeline Funnel**",
      "┌──────────────────────────────┐",
      "│ [KPI] [KPI] [KPI] [KPI]     │",
      "│ ┌────────────────────────┐   │",
      "│ │  ████████ Funnel       │   │",
      "│ │   ██████               │   │",
      "│ └────────────────────────┘   │",
      "│ [Conversion Rate Table]      │",
      "└──────────────────────────────┘",
      "Leads flow top-to-bottom with drop-off rates between stages.",
      "```",
      "",
      "SELF-CHECK: Before sending your response, verify each layout option has a code block wireframe. If any option is just a text description without a wireframe, REWRITE it.",
      "",
      "---",
      "",
      "## Your job (TWO STEPS in this phase)",
      "",
      "### STEP 1: Dashboard vs Product",
      selectedOutcome ? `✅ Outcome already selected: ${selectedOutcome}. Skip to STEP 2.` : "",
      !selectedOutcome ? "Present Dashboard (monitoring) vs Product (client-facing tool) as a quick 2-3 sentence choice." : "",
      !selectedOutcome ? "Call recommendOutcome first if available. Keep it brief — 2-3 sentences per option with your recommendation." : "",
      "",
      "### STEP 2: Present 3 Layout Options (MANDATORY after outcome selection)",
      "Once the user picks Dashboard or Product, present exactly 3 layout options.",
      "Use the MANDATORY FORMAT defined above. No exceptions.",
      "Generate wireframes specific to the user's selected entities and outcome — do not use generic layouts.",
      "",
      "After the user picks a layout, acknowledge in ONE sentence and transition to style.",
      "",
      "## PHASE ADVANCEMENT",
      "After user picks Dashboard or Product AND then selects a layout, call `advancePhase` with nextPhase='style' and selectedValue=<dashboard_or_product>.",
      "Do NOT advance to style until the user has selected BOTH an outcome AND a layout.",
      "",
      "## Behavior rules",
      "- Present STEP 1 first (if outcome not selected), then STEP 2.",
      "- Never skip the layout step. It is mandatory after outcome selection.",
      "- After layout selection, move to style. Do not add more steps.",
      "",
      "## Do NOT",
      "- Do not use paragraphs or bullet points for layout options. Use ASCII wireframes ONLY.",
      "- Do not re-ask Dashboard vs Product after user has confirmed.",
      "- Do not mention internal tool or agent names.",
    ].filter(Boolean).join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: SELECT STYLE
    // ─────────────────────────────────────────────────────────────────────────
    style: [
      "# ⛔ MANDATORY TOOL USAGE - READ THIS FIRST",
      "",
      "You MUST call design tools BEFORE providing ANY style recommendations.",
      "NEVER generate style advice from memory. ALWAYS use tool results.",
      "",
      "## REQUIRED TOOL WORKFLOW:",
      "1. Call `runDesignSystemWorkflow` with workflow context",
      "2. OR call `delegateToDesignAdvisor` for conversational design help",
      "3. ONLY THEN synthesize results into style recommendations",
      "",
      "## TOOL CALL VALIDATION:",
      "- Your response is INVALID if you haven't called at least ONE design tool",
      "- Reference specific values from tool results: style names, hex codes, font names",
      "- Do NOT invent design values - use ONLY what tools return",
      "",
      "---",
      "",
      "# PHASE: SELECT STYLE",
      `Workflow: "${workflowName}" | Outcome: ${selectedOutcome || "Dashboard"}`,
      selectedEntities ? `Tracking: ${selectedEntities}` : "",
      "",
      "## STRICT OUTPUT RULES (CRITICAL)",
      "",
      "DO NOT generate any text, wireframes, or ASCII art before calling tools.",
      "DO NOT describe styles in text - let tool results guide your recommendations.",
      "DO NOT show ASCII box drawings (┌ ┐ └ ┘ │ ─) - this is FORBIDDEN in Phase 3.",
      "",
      "---",
      "",
      "## Your Job: Style Selection",
      "",
      "### PRIMARY PATH: Use runDesignSystemWorkflow (Recommended)",
      "Call `runDesignSystemWorkflow` with:",
      `- workflowName: "${workflowName}"`,
      `- platformType: "${platformType}"`,
      selectedOutcome ? `- selectedOutcome: "${selectedOutcome}"` : "",
      selectedEntities ? `- selectedEntities: "${selectedEntities}"` : "",
      "",
      "This workflow activates the ui-ux-pro-max skill and searches across:",
      "- 50+ UI styles, 97 color palettes, 57 font pairings, 99 UX guidelines",
      "- Returns a complete design system with colors, typography, charts, and guidelines",
      "",
      "Present the result as a design system recommendation. Ask the user:",
      "'Does this style fit your brand? I can generate alternatives if you'd prefer something different.'",
      "",
      "### ALTERNATIVE PATH: Use delegateToDesignAdvisor",
      "- For custom design questions (specific colors, typography, industry patterns)",
      "- The Design Advisor has access to: getStyleRecommendations, getTypographyRecommendations,",
      "  getChartRecommendations, getUXGuidelines, getProductRecommendations",
      "- The advisor MUST use tools - it cannot give recommendations from memory",
      "",
      "## If user wants alternatives",
      "- Call `runDesignSystemWorkflow` again or `delegateToDesignAdvisor` with the user's feedback",
      "- Example: user says 'something darker' → delegateToDesignAdvisor with task: 'dark premium design system'",
      "",
      "## PHASE ADVANCEMENT",
      "After user approves a style, IMMEDIATELY call `advancePhase` with:",
      "- nextPhase: 'build_preview'",
      "- selectedValue: the style name or design system summary",
      "",
      "## Do NOT",
      "- Do not show more than 2 options at once",
      "- Do not re-list styles after the user has chosen",
      "- Do not output raw design tokens or JSON unless explicitly asked",
      "- Do not add unnecessary steps between style selection and preview generation",
      "- NEVER use ASCII box drawings in Phase 3",
      "- NEVER provide style recommendations without calling a design tool first",
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
      "⚠️ CRITICAL: When user says 'generate', 'build', 'create dashboard', or 'preview', you MUST:",
      "",
      "1. Call `delegateToPlatformMapper` with task: 'Generate dashboard preview' and include outcome + style context",
      "2. The specialist will handle: validatePreviewReadiness → runGeneratePreviewWorkflow",
      "3. Do NOT try to generate previews yourself — always delegate to this specialist",
      "",
      "## BUTTON PRESENTATION",
      "When ready to show the generation button, use the suggestAction tool:",
      "- suggestAction({ label: 'Generate Dashboard Preview', actionId: 'generate-preview' })",
      "",
      "## PHASE ADVANCEMENT",
      "After preview generates successfully, call `advancePhase` with nextPhase='interactive_edit'.",
      "",
      "## WHAT TO DO AFTER SPECIALIST COMPLETES:",
      "- If success: Tell user 'Your dashboard preview is ready!' and show the previewUrl",
      "- If error: Say 'I encountered a technical issue' and offer to retry",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5: INTERACTIVE EDIT
    // ─────────────────────────────────────────────────────────────────────────
    interactive_edit: [
      "# PHASE: INTERACTIVE EDIT",
      "",
      "⚠️ CRITICAL: You MUST use tools to handle ANY edit request. Text responses alone are NOT acceptable.",
      "",
      "## MANDATORY WORKFLOW FOR ALL EDIT REQUESTS",
      "When the user asks to change, edit, modify, update, add, remove, or adjust ANYTHING about the dashboard:",
      "",
      "1. **FIRST** call `delegateToDashboardBuilder` with the specific edit request",
      "2. The specialist will handle: getCurrentSpec → applySpecPatch → validateSpec → savePreviewVersion",
      "3. Do NOT try to edit dashboard specs yourself — always delegate to this specialist",
      "",
      "## PHASE ADVANCEMENT",
      "When user says 'deploy', 'ship it', 'looks good', call `advancePhase` with nextPhase='deploy'.",
      "",
      "## EXAMPLES OF EDIT REQUESTS (all require tool calls):",
      "- 'Make it darker with a navy background' → delegateToDashboardBuilder",
      "- 'Add a pie chart showing conversion rates' → delegateToDashboardBuilder", 
      "- 'Change the primary color to blue and increase spacing' → delegateToDashboardBuilder",
      "",
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


/**
 * PHASE_TOOL_ALLOWLIST — The SDK-level gate that prevents LLM bypass.
 *
 * Per AI SDK docs: "activeTools" physically removes tool schemas from
 * the LLM's context. The model cannot call tools not in this list.
 *
 * This replaces the instruction-only approach that failed because
 * tool-error content parts let the LLM route around advancePhase.
 *
 * Tool names must match the keys in masterRouterAgent's tools object.
 */
export const PHASE_TOOL_ALLOWLIST: Record<FloweticPhase, string[]> = {
  select_entity: [
    // Discovery tools
    'getEventStats',
    'getDataDrivenEntities',
    'listSources',
    'getOutcomes',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles
    // select_entity→recommend transition deterministically.
    // Utility (always available)
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
  ],

  recommend: [
    // Outcome recommendation
    'recommendOutcome',
    'getEventStats',
    'getOutcomes',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles
    // recommend→style transition when selected_outcome is present in DB.
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
  ],

  style: [
    // Design tools ONLY — no preview generation, no platform mapping
    'runDesignSystemWorkflow',
    'delegateToDesignAdvisor',
    'getStyleRecommendations',
    'getTypographyRecommendations',
    'getChartRecommendations',
    'getUXGuidelines',
    'getProductRecommendations',
    'getStyleBundles',
    // NOTE: setSchemaReady intentionally omitted — /api/chat auto-sets schema_ready=true
    // when all selections (entities, outcome, style) are present. setSchemaReady is
    // available in build_preview phase via platformMappingMaster only.
    // NOTE: advancePhase intentionally omitted from style phase.
    // Phase transitions are deterministic via autoAdvancePhase in onFinish.
    // Having advancePhase here caused a 14-step tool storm that created
    // duplicate fc_ itemIds, crashing OpenAI Responses API with:
    // "Duplicate item found with id fc_0445fd9e..."
    // See: https://community.openai.com/t/duplicate-item-found-with-id-msg-when-submitting-tool-output-400-invalid-request-error/1373703
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
  ],

  build_preview: [
    // Platform mapping & preview generation
    'delegateToPlatformMapper',
    'validatePreviewReadiness',
    'getEventStats',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles transitions.
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
  ],

  interactive_edit: [
    // Edit tools
    'showInteractiveEditPanel',
    'delegateToDashboardBuilder',
    // Can re-generate if needed
    'delegateToPlatformMapper',
    'validatePreviewReadiness',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles transitions.
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
  ],

  deploy: [
    // NOTE: advancePhase intentionally omitted — deploy is a terminal phase,
    // transitions are handled by the deployment workflow, not the LLM.
    // Can still edit
    'showInteractiveEditPanel',
    'delegateToDashboardBuilder',
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
  ],
};
