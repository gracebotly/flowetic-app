import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from "@mastra/core/processors";
import { PHASE_TOOL_ALLOWLIST, type FloweticPhase } from "@/mastra/agents/instructions/phase-instructions";

/**
 * KNOWN AGENT TOOLS — the tools explicitly registered on masterRouterAgent.
 * These are the ONLY tools we gate. Everything else (e.g. updateWorkingMemory,
 * other Mastra-internal tools) passes through untouched.
 *
 * WHY: Mastra's Memory class injects `updateWorkingMemory` into the agent's
 * ToolSet at runtime. processInputStep's `tools` return is a FULL REPLACE
 * (per official docs: "Replace or modify tools for this step. Use spread to merge").
 * If we only return our allowlisted tools, we strip updateWorkingMemory → crash.
 *
 * KEEP IN SYNC with the tools:{} block in masterRouterAgent.ts.
 */
const KNOWN_AGENT_TOOLS = new Set([
  // Supatools
  'getEventStats',
  'getDataDrivenEntities',
  'recommendOutcome',
  'validatePreviewReadiness',
  // Outcomes
  'getOutcomes',
  // Sources CRUD
  'createSource',
  'listSources',
  'updateSource',
  'deleteSource',
  // Projects CRUD
  'createProject',
  'listProjects',
  'updateProject',
  'deleteProject',
  // Navigation
  'navigateTo',
  // Suggestions
  'suggestAction',
  // Todo
  'todoAdd',
  'todoList',
  'todoUpdate',
  'todoComplete',
  // Design
  'runDesignSystemWorkflow',
  // Delegation
  'delegateToDesignAdvisor',
  'delegateToPlatformMapper',
  'delegateToDashboardBuilder',
  // UI/UX
  'getStyleRecommendations',
  'getChartRecommendations',
  'getTypographyRecommendations',
  'getUXGuidelines',
  'getProductRecommendations',
  // Style bundles
  'getStyleBundles',
  // Editor
  'showInteractiveEditPanel',
  // Phase advancement
  'advancePhase',
  // On-demand skill knowledge search
  'searchSkillKnowledge',
  // Workspace-injected tools (auto-added by Mastra when workspace is assigned).
  // MUST be registered here to prevent phase leakage — without this,
  // these tools pass through the gating processor ungated (available in ALL phases).
  // See: mastra/workspace/index.ts (filesystem: readOnly, bm25: true)
  'mastra_workspace_read_file',
  'mastra_workspace_list_files',
  'mastra_workspace_file_stat',
  'mastra_workspace_search',
]);

/**
 * PhaseToolGatingProcessor — Hard execution-layer tool gating per journey phase.
 *
 * HOW IT WORKS:
 * 1. Reads current phase from RequestContext (set authoritatively from DB in route.ts)
 * 2. For each tool in the current tools set:
 *    - If it's a KNOWN_AGENT_TOOL: only include if it's in the phase allowlist
 *    - If it's NOT a known agent tool (e.g. updateWorkingMemory): always pass through
 * 3. Returns { activeTools: string[] } which FILTERS the existing tool set without
 *    REPLACING it — Mastra-internal tools like updateWorkingMemory stay in the registry.
 *
 * WHY activeTools instead of tools:
 * Returning { tools: filteredTools } is a FULL REPLACE of the tool registry per Mastra
 * docs. This strips updateWorkingMemory (injected by Mastra's Memory class at runtime),
 * causing "Tool updateWorkingMemory not found" crashes. activeTools is an additive filter
 * that preserves all registered tools while controlling which are active for this step.
 */
export class PhaseToolGatingProcessor implements Processor {
  readonly id = "phase-tool-gating";
  readonly name = "Phase Tool Gating";

  processInputStep({
    stepNumber,
    tools,
    requestContext,
  }: ProcessInputStepArgs): ProcessInputStepResult {
    const currentPhase = (requestContext?.get?.("phase") as FloweticPhase) || "select_entity";
    const rawAllowedNames = PHASE_TOOL_ALLOWLIST[currentPhase] || PHASE_TOOL_ALLOWLIST.select_entity;

    if (!tools) {
      return {};
    }

    // CRITICAL: Only include tools that ACTUALLY EXIST in the tools map.
    // LLMs can hallucinate tool names. If we pass them through, Mastra crashes with
    // "Tool X not found" which kills the entire stream.
    // The gating processor is the last line of defense.
    const existingToolNames = new Set(Object.keys(tools));
    const safeAllowed = rawAllowedNames.filter(name => existingToolNames.has(name));
    if (safeAllowed.length !== rawAllowedNames.length) {
      const missing = rawAllowedNames.filter(name => !existingToolNames.has(name));
      console.warn(`[PhaseToolGating] Removed ${missing.length} non-existent tools from allowlist:`, missing);
    }
    const allowedToolNames = new Set(safeAllowed);

    const totalTools = Object.keys(tools).length;
    const activeToolNames: string[] = [];
    const passedThrough: string[] = [];
    let gatedCount = 0;

    for (const toolName of Object.keys(tools)) {
      if (KNOWN_AGENT_TOOLS.has(toolName)) {
        // This is one of our agent tools — only include if phase-allowed
        if (allowedToolNames.has(toolName)) {
          activeToolNames.push(toolName);
        } else {
          gatedCount++;
        }
      } else {
        // Not a known agent tool (e.g. updateWorkingMemory) — always pass through
        activeToolNames.push(toolName);
        passedThrough.push(toolName);
      }
    }

    if (stepNumber === 0) {
      console.log(
        `[PhaseToolGating] phase=${currentPhase} active=${activeToolNames.length}/${totalTools} (gated=${gatedCount}, passthrough=[${passedThrough.join(',')}])`
      );
      // FIX (P2): Warn when agent tools are missing from KNOWN_AGENT_TOOLS.
      // Any tool NOT in KNOWN_AGENT_TOOLS becomes phase-agnostic (pass-through),
      // which means it's available in ALL phases — defeating the purpose of gating.
      // This catches the case where a new tool is added to masterRouterAgent.tools
      // but not added to KNOWN_AGENT_TOOLS, creating a silent phase leakage.
      // Known Mastra-internal tools that should always pass through:
      const MASTRA_INTERNAL_TOOLS = new Set([
        'updateWorkingMemory',
        'getWorkingMemory',
      ]);
      const unregisteredAgentTools = passedThrough.filter(
        toolName => !MASTRA_INTERNAL_TOOLS.has(toolName)
      );
      if (unregisteredAgentTools.length > 0) {
        console.warn(
          `[PhaseToolGating] ⚠️ PHASE LEAKAGE RISK: ${unregisteredAgentTools.length} tool(s) not in KNOWN_AGENT_TOOLS — these are phase-agnostic (available in ALL phases): [${unregisteredAgentTools.join(', ')}]. ` +
          `Add them to KNOWN_AGENT_TOOLS in phase-tool-gating.ts and to the appropriate phase in PHASE_TOOL_ALLOWLIST.`
        );
      }
    }

    // If nothing was gated, don't modify anything
    if (gatedCount === 0) {
      return {};
    }

    // BUG 4 DEFENSE: Detect AI SDK #8653 phantom tool call attempts.
    // If the agent attempts to call advancePhase while in recommend phase
    // and advancePhase is NOT in the allowlist, this means the AI SDK bug
    // allowed the tool call through despite activeTools filtering.
    // The primary defense is tool-level validation in advancePhase.ts.
    const currentPhaseForLog = requestContext?.get?.('phase') as string | undefined;
    if (currentPhaseForLog === 'recommend') {
      const allowedForRecommend = PHASE_TOOL_ALLOWLIST['recommend'] || [];
      if (!allowedForRecommend.includes('advancePhase')) {
        // advancePhase is not in the allowlist — if it still gets called,
        // that's the AI SDK #8653 bug. Log it for monitoring.
        console.log('[PhaseToolGating] advancePhase correctly excluded from recommend allowlist. Tool-level validation is primary defense.');
      }
    }

    // Use activeTools (string array) instead of tools (object replace).
    // This FILTERS the existing tool set without REPLACING it —
    // Mastra-internal tools like updateWorkingMemory stay in the registry.
    return {
      activeTools: activeToolNames,
      toolChoice: activeToolNames.length > 0 ? ("auto" as const) : ("none" as const),
    };
  }
}
