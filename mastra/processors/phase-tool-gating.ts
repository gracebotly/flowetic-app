import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";
import { PHASE_TOOL_ALLOWLIST, type FloweticPhase } from "@/mastra/agents/instructions/phase-instructions";

/**
 * PhaseToolGatingProcessor — Hard execution-layer tool gating per journey phase.
 *
 * WHY THIS EXISTS:
 * - activeTools (AI SDK) only filters schemas, NOT execution (bug #8653)
 * - prepareStep with raw tool imports bypasses Mastra's RequestContext wrapping
 * - processInputStep receives ALREADY-WRAPPED tools from the agent, so filtering
 *   them preserves RequestContext while enforcing hard execution gating
 *
 * HOW IT WORKS:
 * 1. Uses the phase captured at request time (set authoritatively from DB in route.ts)
 * 2. Filters the tools object to only include phase-allowed tools
 * 3. Returns { tools: filteredTools } which REPLACES the execution-layer tools
 * 4. Tools not in the filtered set literally don't exist — LLM can't call them
 *
 * EXECUTION ORDER (per Mastra docs):
 * processInput (once) → processInputStep (each step) → prepareStep → LLM → tools → loop
 */
export class PhaseToolGatingProcessor implements Processor {
  readonly id = "phase-tool-gating";
  readonly name = "Phase Tool Gating";

  private readonly phase: FloweticPhase;

  constructor(phase: FloweticPhase = "select_entity") {
    this.phase = phase;
  }

  processInputStep({ stepNumber, tools }: ProcessInputStepArgs) {
    const currentPhase = this.phase;
    const allowedToolNames =
      PHASE_TOOL_ALLOWLIST[currentPhase] || PHASE_TOOL_ALLOWLIST.select_entity;

    if (!tools) {
      return {};
    }

    // Filter to only allowed tools — these retain their Mastra wrapping + RequestContext
    const filteredTools: Record<string, any> = {};
    for (const name of allowedToolNames) {
      if ((tools as Record<string, any>)[name]) {
        filteredTools[name] = (tools as Record<string, any>)[name];
      }
    }

    const totalTools = Object.keys(tools as object).length;
    const allowedCount = Object.keys(filteredTools).length;

    if (stepNumber === 0) {
      // Only log on first step to avoid noise
      console.log(`[PhaseToolGating] phase=${currentPhase} tools=${allowedCount}/${totalTools}`);

      if (allowedCount < allowedToolNames.length) {
        const missing = allowedToolNames.filter(
          (n) => !(tools as Record<string, any>)[n]
        );
        console.warn(`[PhaseToolGating] Missing from agent tools: ${missing.join(", ")}`);
      }
    }

    return {
      tools: filteredTools,
      toolChoice: allowedCount > 0 ? ("auto" as const) : ("none" as const),
    };
  }
}
