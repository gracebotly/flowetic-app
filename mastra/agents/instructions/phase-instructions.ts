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
      "Phase transitions are automatic. When the user selects entities, the system advances to the recommend phase automatically.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: RECOMMEND OUTCOME + WIREFRAME PREVIEW
    // ─────────────────────────────────────────────────────────────────────────
    recommend: [
      "# PHASE: RECOMMEND OUTCOME + WIREFRAME PREVIEW",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Selected entities: ${selectedEntities}` : "",
      "",
      "## Your job (TWO STEPS in this phase)",
      "",
      "### STEP 1: Dashboard vs Product",
      selectedOutcome ? `✅ Outcome already selected: ${selectedOutcome}. Skip to STEP 2.` : "",
      !selectedOutcome ? "Present Dashboard (monitoring) vs Product (client-facing tool) as a quick 2-3 sentence choice." : "",
      !selectedOutcome ? "Ask the user: 'Would you like a **Dashboard** for monitoring your workflows, or a **Product** interface for your clients?' Keep it to 2-3 sentences explaining each option." : "",
      "",
      "### STEP 2: Generate ONE Smart Wireframe Preview (MANDATORY after outcome selection)",
      "",
      "Once the user picks Dashboard or Product, generate a SINGLE wireframe that previews",
      "what the system will build. You already have everything you need:",
      `- Platform: ${platformType} (determines the template and component types)`,
      selectedEntities ? `- Entities: ${selectedEntities} (determines KPIs, charts, and table columns)` : "- Entities: (from user's selection in previous phase)",
      selectedOutcome ? `- Outcome: ${selectedOutcome} (dashboard monitoring vs client-facing product)` : "- Outcome: (from Step 1)",
      "",
      "DO NOT present 3 options. DO NOT ask the user to 'pick a layout.'",
      "Generate ONE wireframe that accurately represents the dashboard they are about to get.",
      "",
      "# ⛔ MANDATORY OUTPUT FORMAT FOR WIREFRAME (READ THIS FIRST)",
      "",
      "The wireframe MUST use this EXACT format:",
      "  1. A brief intro: 'Based on your selections, here\\'s what your dashboard will look like:'",
      "  2. A code block with 5-10 line ASCII wireframe using ┌ ┐ └ ┘ │ ─ characters",
      "  3. A 1-2 sentence explanation of what each section shows",
      "  4. The question: 'Does this look right? I can adjust before we move to styling.'",
      "",
      "ANTI-PATTERN — NEVER do this:",
      "```",
      "❌ BAD: Presenting 3 options for the user to pick from.",
      "❌ BAD: Text description without ASCII wireframe.",
      "❌ BAD: Generic wireframe that doesn't reflect the user's entities.",
      "```",
      "",
      "CORRECT FORMAT — ALWAYS do this:",
      "```",
      "✅ GOOD: One tailored wireframe based on the user's data:",
      "",
      "Based on your selections, here's what your dashboard will look like:",
      "",
      "┌──────────────────────────────────────────┐",
      "│ [Total Runs] [Success Rate] [Avg Time]   │",
      "├──────────────────────────┬───────────────┤",
      "│                          │               │",
      "│   📈 Runs Over Time      │  Status Split │",
      "│                          │   ● ● ●       │",
      "├──────────────────────────┴───────────────┤",
      "│  Recent Runs                             │",
      "│  ID | Workflow | Status | Duration | Time│",
      "└──────────────────────────────────────────┘",
      "",
      "Top row: Key metrics from your tracked entities.",
      "Middle: Timeline of activity + status breakdown.",
      "Bottom: Recent activity log with details.",
      "",
      "Does this look right? I can adjust before we move to styling.",
      "```",
      "",
      "IMPORTANT: Replace the example KPIs, charts, and table columns with the user's",
      "ACTUAL selected entities and platform-appropriate metrics. A Vapi dashboard should",
      "show call metrics. An n8n dashboard should show workflow execution metrics.",
      "",
      "## WIREFRAME CONFIRMATION",
      "",
      "After showing the wireframe, WAIT for the user to respond.",
      "- If user says 'yes', 'looks good', 'let\\'s go', 'confirmed', etc.:",
      "  The system will detect the confirmation and advance to style automatically.",
      "- If user asks for changes (e.g., 'add a pie chart', 'show costs too'):",
      "  Regenerate the wireframe with adjustments and ask again.",
      "- Do NOT advance to style until the user has confirmed the wireframe.",
      "",
      "## PHASE ADVANCEMENT",
      "Phase transitions are automatic. After the user confirms the wireframe,",
      "the system sets wireframe_confirmed=true and advances to style via autoAdvancePhase.",
      "You do NOT need to call any tool to advance the phase.",
      "Do NOT attempt to advance to style until the user has BOTH selected an outcome",
      "AND confirmed the wireframe preview.",
      "",
      "## Behavior rules",
      "- Present STEP 1 first (if outcome not selected), then STEP 2.",
      "- Never skip the wireframe step. It is mandatory after outcome selection.",
      "- Generate ONE wireframe tailored to the user's data — NOT 3 options.",
      "- After wireframe confirmation, move to style. Do not add more steps.",
      "",
      "## Do NOT",
      "- Do not present multiple layout options. One wireframe only.",
      "- Do not re-ask Dashboard vs Product after user has confirmed.",
      "- Do not mention internal tool or agent names.",
      "- Do not advance to style without wireframe confirmation.",
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
      "Phase transitions are automatic. When the user selects a style bundle,",
      "the system writes the selection to the database and advances to build_preview automatically.",
      "You do NOT need to call any tool to advance the phase.",
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
      "## AUTO-GENERATE (NO BUTTON)",
      "Do NOT use suggestAction to show a 'Generate' button. Instead, IMMEDIATELY call",
      "delegateToPlatformMapper when you enter this phase. The user already selected their",
      "style — they expect the preview to generate automatically without clicking a button.",
      "",
      "## PHASE ADVANCEMENT",
      "Phase transitions are automatic. After the preview is generated and saved,",
      "the system advances to interactive_edit automatically via autoAdvancePhase.",
      "You do NOT need to call any tool to advance the phase.",
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
      "When the user confirms they want to deploy (e.g., 'deploy', 'ship it', 'looks good'),",
      "acknowledge their intent. The system handles the phase transition automatically.",
      "You do NOT need to call any tool to advance the phase.",
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
    'getOutcomes',
    'searchSkillKnowledge',
    // Sources — read-only in discovery phase
    // FIX (P0): createSource/updateSource/deleteSource REMOVED from select_entity.
    // Having write tools here caused the agent to hallucinate source creation during
    // entity discovery, leading to duplicate key crashes. Source CRUD is available
    // in build_preview and interactive_edit phases where it belongs.
    'listSources',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles
    // select_entity→recommend transition deterministically.
    // Utility (always available)
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
    // Workspace tools (read-only filesystem + BM25 skill search)
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
  ],

  recommend: [
    // NOTE: recommendOutcome REMOVED — outcome selection is now deterministic.
    // Code in route.ts detects "dashboard" / "product" from user message and
    // writes selected_outcome to DB. Agent only presents the choice conversationally.
    'getEventStats',
    'getOutcomes',
    'searchSkillKnowledge',
    // skill-activate and skill-search intentionally OMITTED from recommend.
    // These are gated in phase-tool-gating.ts. In recommend phase, the agent
    // only needs to help the user choose Dashboard vs Product — no skill
    // activation needed. Skills load in style/build_preview/interactive_edit.
    // BUG 4 FIX: advancePhase REMOVED from recommend phase.
    // Phase transitions are deterministic via autoAdvancePhase in onFinish.
    // autoAdvancePhase handles recommend → style when BOTH selected_outcome
    // AND wireframe_confirmed are true. The agent must NOT manually advance
    // phases during recommend — this was the root cause of Bug 4 where the
    // agent bypassed the wireframe confirmation gate.
    // See also: AI SDK Issue #8653 — activeTools filtering doesn't prevent
    // tool execution from conversation memory, making allowlist removal
    // insufficient alone (tool-level validation in advancePhase.ts is primary defense).
    // BUG 9 FIX: suggestAction REMOVED from recommend phase.
    // The "Generate Dashboard Preview" button was appearing after wireframe
    // because suggestAction was in the allowlist. Preview generation should
    // ONLY happen in build_preview phase. Removing this prevents premature
    // preview button display.
    // Phase transitions are deterministic via autoAdvancePhase in onFinish.
    // Utility
    'navigateTo',
    // 'suggestAction', ← REMOVED (Bug 9 fix)
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
    // Workspace tools (read-only filesystem + BM25 skill search)
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
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
    'getColorRecommendations',
    'getIconRecommendations',
    'searchSkillKnowledge',
    'skill-activate',
    'skill-search',
    // getStyleBundles REMOVED — preset system deprecated in favour of custom tokens
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
    // Workspace tools (read-only filesystem + BM25 skill search)
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
  ],

  build_preview: [
    // Platform mapping & preview generation
    'delegateToPlatformMapper',
    'validatePreviewReadiness',
    'getEventStats',
    'searchSkillKnowledge',
    'skill-activate',
    'skill-search',
    // Design tools (for style adjustments during preview — user may say
    // "make this more premium" or "change to a dark theme" during build)
    'getStyleRecommendations',
    'getColorRecommendations',
    'getTypographyRecommendations',
    'getChartRecommendations',
    'getUXGuidelines',
    'getProductRecommendations',
    'getIconRecommendations',
    // Sources CRUD (moved here from select_entity — agent may need to
    // create/update sources during build phase for data connectivity)
    'createSource',
    'listSources',
    'updateSource',
    'deleteSource',
    // Projects CRUD (may need to create/update project during build)
    'createProject',
    'listProjects',
    'updateProject',
    'deleteProject',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles transitions.
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
    // Workspace tools (read-only filesystem + BM25 skill search)
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
  ],

  interactive_edit: [
    // Edit tools
    'showInteractiveEditPanel',
    'delegateToDashboardBuilder',
    'searchSkillKnowledge',
    'skill-activate',
    'skill-search',
    // Design tools (for style adjustments during editing — user may request
    // color changes, font swaps, or chart type modifications)
    'getStyleRecommendations',
    'getColorRecommendations',
    'getTypographyRecommendations',
    'getChartRecommendations',
    'getUXGuidelines',
    'getProductRecommendations',
    'getIconRecommendations',
    // Can re-generate if needed
    'delegateToPlatformMapper',
    'validatePreviewReadiness',
    // Projects CRUD
    'createProject',
    'listProjects',
    'updateProject',
    'deleteProject',
    // NOTE: advancePhase intentionally omitted — autoAdvancePhase handles transitions.
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
    // Workspace tools (read-only filesystem + BM25 skill search)
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
  ],

  deploy: [
    // NOTE: advancePhase intentionally omitted — deploy is a terminal phase,
    // transitions are handled by the deployment workflow, not the LLM.
    // Can still edit
    'showInteractiveEditPanel',
    'searchSkillKnowledge',
    'delegateToDashboardBuilder',
    // Projects CRUD (final project updates during deploy)
    'listProjects',
    'updateProject',
    // Utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
    // Workspace tools (read-only filesystem + BM25 skill search)
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
  ],
};
