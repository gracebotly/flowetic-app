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
  // Sources
  'listSources',
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
  // Style keywords
  'recommendStyleKeywords',
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
    const allowedToolNames = new Set(
      PHASE_TOOL_ALLOWLIST[currentPhase] || PHASE_TOOL_ALLOWLIST.select_entity
    );

    if (!tools) {
      return {};
    }

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
    }

    // If nothing was gated, don't modify anything
    if (gatedCount === 0) {
      return {};
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
