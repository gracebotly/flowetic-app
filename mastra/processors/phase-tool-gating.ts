import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from "@mastra/core";
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
 *    - If it's a KNOWN_AGENT_TOOL: only keep if it's in the phase allowlist
 *    - If it's NOT a known agent tool (e.g. updateWorkingMemory): always keep
 * 3. Returns { tools: filteredTools } which replaces the execution-layer tools
 *
 * This preserves Mastra-internal tools (memory, etc.) while gating our agent tools.
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

    // Filter tools: gate known agent tools by phase, pass through everything else
    const filteredTools: Record<string, any> = {};
    let gatedCount = 0;
    const passedThrough: string[] = [];

    for (const [name, tool] of Object.entries(tools)) {
      if (KNOWN_AGENT_TOOLS.has(name)) {
        // This is one of our agent tools — only include if phase-allowed
        if (allowedToolNames.has(name)) {
          filteredTools[name] = tool;
        } else {
          gatedCount++;
        }
      } else {
        // Not a known agent tool (e.g. updateWorkingMemory) — always pass through
        filteredTools[name] = tool;
        passedThrough.push(name);
      }
    }

    const totalTools = Object.keys(tools).length;
    const resultCount = Object.keys(filteredTools).length;

    if (stepNumber === 0) {
      console.log(
        `[PhaseToolGating] phase=${currentPhase} tools=${resultCount}/${totalTools} (gated=${gatedCount}, passthrough=[${passedThrough.join(',')}])`
      );
    }

    return {
      tools: filteredTools,
      toolChoice: resultCount > 0 ? ("auto" as const) : ("none" as const),
    };
  }
}
