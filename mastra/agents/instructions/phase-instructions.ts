import type { RequestContext } from "@mastra/core/request-context";

export type FloweticPhase =
  | "propose"
  | "build_edit"
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
  fallback: FloweticPhase = "propose",
): FloweticPhase {
  const raw = String(requestContext?.get?.("phase") ?? requestContext?.get?.("mode") ?? "").trim();
  if (!raw) return fallback;

  // Legacy aliases — map old 6-phase names to new 3-phase names
  if (raw === "select_entity" || raw === "recommend" || raw === "style" || raw === "outcome" || raw === "align" || raw === "story") {
    return "propose";
  }
  if (raw === "build_preview" || raw === "interactive_edit") {
    return "build_edit";
  }

  const allowed: FloweticPhase[] = [
    "propose",
    "build_edit",
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
    // PHASE 1: PROPOSE
    // System analyzed data, classified archetype, generated 2-3 proposals.
    // Agent presents them, user picks one.
    // ─────────────────────────────────────────────────────────────────────────
    propose: [
      "# PHASE: PROPOSE",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      "",
      "You are presenting AI-generated dashboard proposals to the user.",
      "The system has already:",
      "- Analyzed their data (entities, fields, event types)",
      "- Classified their workflow archetype",
      "- Generated 2-3 complete proposals with custom design systems and wireframes",
      "",
      "The proposals are rendered as visual cards in the right panel.",
      "",
      "## Your job:",
      "1. Open with a brief, confident analysis of their data (2-3 sentences max)",
      "2. Explain what you found and why each proposal fits their workflow",
      "3. If user asks questions, answer from the analysis data",
      "4. If user picks a proposal, confirm their choice enthusiastically",
      "5. If user says 'none of these' or wants different options, offer to regenerate",
      "",
      "## Do NOT:",
      "- Ask what kind of UI they want — the proposals already cover the options",
      "- Show raw JSON or technical details",
      "- Hedge or be uncertain — be confident like a design lead presenting to a client",
      "- Skip straight to building — the user MUST pick a proposal first",
      "",
      "## Phase advancement:",
      "When the user selects a proposal via __ACTION__:select_proposal:N or natural language,",
      "the system advances to build_edit automatically.",
      "You do NOT need to call any tool to advance the phase.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: BUILD + EDIT
    // System builds the preview from the selected proposal. User iterates.
    // ─────────────────────────────────────────────────────────────────────────
    build_edit: [
      "# PHASE: BUILD + EDIT",
      `Workflow: "${workflowName}" | Platform: ${platformType}`,
      selectedEntities ? `Entities: ${selectedEntities}` : "",
      selectedOutcome ? `Outcome: ${selectedOutcome}` : "",
      "",
      "The user selected a proposal and the system is building (or has built) their preview.",
      "Once the preview is ready, they are in interactive edit mode.",
      "",
      "## Your job:",
      "1. If the preview is still building, keep the user informed with brief status updates",
      "2. Once the preview is ready, celebrate briefly and explain what they can edit",
      "3. Handle edit requests: color changes, add/remove components, rearrange layout",
      "4. When user is satisfied, offer deployment",
      "",
      "## For ALL edit requests:",
      "1. Call `delegateToDashboardBuilder` with the specific edit request",
      "2. The specialist handles: getCurrentSpec → applySpecPatch → validateSpec → savePreviewVersion",
      "3. Do NOT try to edit dashboard specs yourself — always delegate",
      "",
      "## For preview generation:",
      "1. Call `delegateToPlatformMapper` with task: 'Generate dashboard preview'",
      "2. The specialist handles: validatePreviewReadiness → runGeneratePreviewWorkflow",
      "",
      "## EXAMPLES OF EDIT REQUESTS (all require tool calls):",
      "- 'Make it darker with a navy background' → delegateToDashboardBuilder",
      "- 'Add a pie chart showing conversion rates' → delegateToDashboardBuilder",
      "- 'Change the primary color to blue and increase spacing' → delegateToDashboardBuilder",
      "",
      "## Phase advancement:",
      "When user confirms they want to deploy, the system handles transition automatically.",
    ].join("\n"),

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: DEPLOY
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
    propose: "Choose a proposal",
    build_edit: "Build & edit dashboard",
    deploy: "Deploy confirmation",
  };
  return descriptions[phase] ?? phase;
}

export function getNextPhase(current: FloweticPhase): FloweticPhase | null {
  const order: FloweticPhase[] = ["propose", "build_edit", "deploy"];
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
  propose: [
    // Analysis tools — agent may need to look up data for answering questions
    'getEventStats',
    'getDataDrivenEntities',
    'searchSkillKnowledge',
    // Navigation
    'navigateTo',
    // Read-only sources
    'listSources',
  ],

  build_edit: [
    // Platform mapping & preview generation
    'delegateToPlatformMapper',
    'delegateToDashboardBuilder',
    'validatePreviewReadiness',
    'getEventStats',
    'searchSkillKnowledge',
    'skill-activate',
    'skill-search',
    // Design tools
    'getStyleRecommendations',
    'getColorRecommendations',
    'getTypographyRecommendations',
    'getChartRecommendations',
    'getUXGuidelines',
    'getProductRecommendations',
    'getIconRecommendations',
    'runDesignSystemWorkflow',
    'delegateToDesignAdvisor',
    // Editor
    'showInteractiveEditPanel',
    // Sources CRUD — REMOVED from build_edit.
    // During build_edit, the agent is locked to the selected workflow's source
    // (from RequestContext). Discovery/CRUD tools caused the agent to see all
    // tenant sources and get confused (passing wrong sourceId, listing Make + n8n).
    // Source management belongs in propose phase or a dedicated settings phase.
    // Projects CRUD
    'createProject',
    'listProjects',
    'updateProject',
    'deleteProject',
    // Navigation & utility
    'navigateTo',
    'suggestAction',
    'todoAdd',
    'todoList',
    'todoUpdate',
    'todoComplete',
    // Workspace tools
    'mastra_workspace_read_file',
    'mastra_workspace_list_files',
    'mastra_workspace_file_stat',
    'mastra_workspace_search',
    // Phase advancement (manual override for stuck states)
    'advancePhase',
  ],

  deploy: [
    'navigateTo',
    'suggestAction',
    'listProjects',
    'advancePhase',
  ],
};
