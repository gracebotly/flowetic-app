import type { Processor, ProcessInputStepArgs } from "@mastra/core/processors";

/**
 * Enforces design token system by preventing direct spec generation.
 *
 * Phase 2 Guardrail: Forces all spec generation through generateUISpec tool
 * or runGeneratePreviewWorkflow, which use canonical STYLE_BUNDLE_TOKENS.
 */
export class DesignTokenEnforcer implements Processor {
  readonly id = "design-token-enforcer";
  readonly name = "Design Token Enforcer";

  processInputStep({
    stepNumber,
    tools,
    activeTools,
  }: ProcessInputStepArgs) {
    // Allow normal tool use on first step
    if (stepNumber === 0) {
      return {};
    }

    // If generateUISpec or runGeneratePreviewWorkflow are being called, that's fine
    // They enforce tokens internally
    const allowedSpecTools = [
      'generateUISpec',
      'runGeneratePreviewWorkflow'
    ];

    // Check if any active tools match our allowed list
    const hasAllowedSpecTool = activeTools?.some(toolName =>
      allowedSpecTools.includes(toolName)
    );

    if (hasAllowedSpecTool) {
      return {};
    }

    // After first step, if agent has NOT used spec-generation tools,
    // prevent it from trying to create specs in conversation
    // by removing spec-editing tools from subsequent steps
    const speculativeSpecTools = [
      'applySpecPatch',
      'savePreviewVersion'
    ];

    if (activeTools) {
      const filteredTools = activeTools.filter(
        toolName => !speculativeSpecTools.includes(toolName)
      );

      // If we filtered out tools, return the reduced set
      if (filteredTools.length !== activeTools.length) {
        console.warn(
          `[DesignTokenEnforcer] Blocked speculative spec tools at step ${stepNumber}. ` +
          `Agent must use generateUISpec or workflow for spec creation.`
        );
        return { activeTools: filteredTools };
      }
    }

    return {};
  }
}
