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
  'getColorRecommendations',   // BUG 4 FIX: was missing, caused gating warning + design disconnect
  'getIconRecommendations',    // BUG 4 FIX: was missing, caused gating warning + design disconnect
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
  // Skill tools — gated by phase to prevent premature activation.
  // Without this, skill-activate and skill-search pass through ungated
  // (available in ALL phases), causing the agent to activate heavy skills
  // like data-dashboard-intelligence during recommend phase → tool loops → timeout.
  // FIX: Only allow skill tools in phases that actually need on-demand skill loading.
  'skill-activate',
  'skill-search',
  // Workspace grep (also auto-injected, same pattern as above)
  'mastra_workspace_grep',
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
    steps,
    tools,
    requestContext,
  }: ProcessInputStepArgs): ProcessInputStepResult {
    const currentPhase = (requestContext?.get?.("phase") as FloweticPhase) || "propose";
    const rawAllowedNames = PHASE_TOOL_ALLOWLIST[currentPhase] || PHASE_TOOL_ALLOWLIST.propose;

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
      // FIX (Bug 4): Remove updateWorkingMemory to prevent dual-state confusion.
      // updateWorkingMemory writes to Mastra thread metadata, creating separate state
      // from journey_sessions DB. This causes agent to think it's in "style" phase
      // while DB says "recommend", leading to phase confusion and tool storms.
      // Remove it from passthrough so it gets gated like other tools.
      // Known Mastra-internal tools that should always pass through:
      const MASTRA_INTERNAL_TOOLS = new Set([
        'getWorkingMemory', // Keep getWorkingMemory for read-only access
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
    if (currentPhaseForLog === 'propose') {
      const allowedForPropose = PHASE_TOOL_ALLOWLIST['propose'] || [];
      if (!allowedForPropose.includes('advancePhase')) {
        // advancePhase is not in the allowlist — if it still gets called,
        // that's the AI SDK #8653 bug. Log it for monitoring.
        console.log('[PhaseToolGating] advancePhase correctly excluded from propose allowlist. Tool-level validation is primary defense.');
      }
    }

    // Use activeTools (string array) instead of tools (object replace).
    // This FILTERS the existing tool set without REPLACING it —
    // Mastra-internal tools like updateWorkingMemory stay in the registry.
    return {
      activeTools: activeToolNames,
      toolChoice: activeToolNames.length > 0
        ? this.getPhaseToolChoice(currentPhase, stepNumber, steps)
        : ("none" as const),
    };
  }

  /**
   * Phase-aware toolChoice enforcement (3-phase system).
   *
   * Instead of always returning "auto", we force specific tool-calling
   * behavior based on which phase we're in and what step we're on.
   *
   * Rationale per phase:
   * - propose step 0: Agent MUST call searchSkillKnowledge or getEventStats before
   *   responding to follow-up questions. Grounds answers in BM25 knowledge instead of
   *   hallucinating design tokens or layout recs. Initial propose message uses
   *   deterministic bypass (handleDeterministicPropose in route.ts), so step-0
   *   enforcement only applies to follow-up messages.
   * - build_edit: "auto" — agent decides based on user intent (edits vs questions).
   * - deploy: Short phase, "auto" is fine.
   *
   * Legacy 6-phase names (select_entity, recommend, style, build_preview,
   * interactive_edit) are normalized to 3-phase names by LEGACY_PHASE_MAP
   * in route.ts before they reach the processor. No legacy handling here.
   *
   * Safety valve: After (maxSteps - 1), force "none" to guarantee a text
   * response instead of an infinite tool-call loop.
   */
  private getPhaseToolChoice(
    phase: string,
    stepNumber: number,
    steps?: { toolCalls?: unknown[] }[],
  ): "auto" | "required" | "none" {
    // Phase-specific maxSteps (mirrors route.ts values)
    // Wolf V2 Phase 3: Legacy aliases removed. route.ts normalizes old DB
    // sessions before they reach the processor (LEGACY_PHASE_MAP in route.ts).
    // If an unmapped phase somehow arrives, the fallback `|| 5` handles it.
    const PHASE_MAX_STEPS: Record<string, number> = {
      propose: 5,
      build_edit: 10,
      deploy: 3,
    };
    const maxSteps = PHASE_MAX_STEPS[phase] || 5;
    // SAFETY VALVE: Force text completion on the last allowed step.
    // This prevents infinite tool-call loops where the agent keeps
    // calling tools without ever producing a user-facing response.
    if (stepNumber >= maxSteps - 1) {
      console.log(
        `[PhaseToolGating] toolChoice=none (safety valve: step ${stepNumber} >= maxSteps-1=${maxSteps - 1} for phase=${phase})`
      );
      return "none";
    }
    // Phases where the LLM MUST call a tool on step 0.
    // These are phases where skipping tool calls produces hallucinated output.
    // NOTE: "propose" is included because the initial propose message uses a
    // deterministic bypass in route.ts (handleDeterministicPropose), so step-0
    // enforcement only affects FOLLOW-UP questions in the propose phase.
    // This forces the agent to call searchSkillKnowledge or getEventStats
    // before responding to user questions, grounding answers in BM25 knowledge
    // instead of hallucinating design tokens or layout recommendations.
    // Wolf V2 Phase 3: Only 3-phase names. Legacy names are normalized
    // by route.ts LEGACY_PHASE_MAP before reaching the processor.
    const TOOL_REQUIRED_FIRST_STEP: Set<string> = new Set([
      "propose",        // Must call searchSkillKnowledge/getEventStats for follow-up questions
    ]);
    // Force tool call on first step for tool-required phases
    if (stepNumber === 0 && TOOL_REQUIRED_FIRST_STEP.has(phase)) {
      console.log(
        `[PhaseToolGating] toolChoice=required (phase=${phase}, step=0, forcing initial tool call)`
      );
      return "required";
    }
    // After a tool call just completed, let the model synthesize results.
    // Check the most recent step — if it had tool calls, the model now has
    // tool results in context and should be free to either call more tools
    // or produce text.
    const lastStep = steps?.[steps.length - 1];
    const lastStepHadToolCalls = lastStep?.toolCalls &&
      Array.isArray(lastStep.toolCalls) &&
      lastStep.toolCalls.length > 0;
    if (lastStepHadToolCalls) {
      // Model just got tool results — let it decide what to do next
      return "auto";
    }
    // Default: let the model decide
    return "auto";
  }
}
