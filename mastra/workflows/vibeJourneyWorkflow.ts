import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RequestContext } from "@mastra/core/request-context";
import { detectSelection } from "../validation/selection-checks";
import { getMastra } from "../index";

type SelectionKind = "entity" | "outcome" | "storyboard" | "style_bundle" | "deploy";

const VibeJourneySuspendSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  // Optional diagnostic string for debugging
  error: z.string().optional(),
});

const VibeJourneyResumeSchema = z.object({
  userSelection: z.string().min(1),
  selectionType: z.enum(["entity", "outcome", "storyboard", "style_bundle"]),
});

const FloweticPhase = z.enum([
  "select_entity",
  "recommend",
  "align",
  "style",
  "build_preview",
  "interactive_edit",
  "deploy",
]);
export type FloweticPhase = z.infer<typeof FloweticPhase>;

export const VibeJourneyInput = z.object({
  userMessage: z.string().min(1),
});

export const VibeJourneyState = z.object({
  currentPhase: FloweticPhase.default("select_entity"),

  // Selections tracked across phases:
  selectedEntity: z.string().optional(),
  selectedOutcome: z.string().optional(),
  selectedStoryboard: z.string().optional(),
  selectedStyleBundleId: z.string().optional(),

  // Context:
  platformType: z.string().default("make"),
  workflowName: z.string().default(""),
});

export type VibeJourneyState = z.infer<typeof VibeJourneyState>;

export const VibeJourneyOutput = z.object({
  text: z.string(),
  state: VibeJourneyState,
});

function safeSetRequestContext(requestContext: RequestContext | undefined, key: string, value: unknown) {
  try {
    if (requestContext && typeof (requestContext as any).set === "function") {
      (requestContext as any).set(key, value);
    }
  } catch {
    // ignore
  }
}

function applyStateToRequestContext(params: {
  requestContext: RequestContext | undefined;
  state: VibeJourneyState;
}) {
  const { requestContext, state } = params;

  safeSetRequestContext(requestContext, "phase", state.currentPhase);
  safeSetRequestContext(requestContext, "mode", state.currentPhase);

  if (state.workflowName) safeSetRequestContext(requestContext, "workflowName", state.workflowName);
  if (state.platformType) safeSetRequestContext(requestContext, "platformType", state.platformType);

  if (state.selectedEntity) safeSetRequestContext(requestContext, "selectedEntity", state.selectedEntity);
  if (state.selectedOutcome) safeSetRequestContext(requestContext, "selectedOutcome", state.selectedOutcome);
  if (state.selectedStoryboard) safeSetRequestContext(requestContext, "selectedStoryboard", state.selectedStoryboard);
  if (state.selectedStyleBundleId) safeSetRequestContext(requestContext, "selectedStyleBundleId", state.selectedStyleBundleId);
}

function nextPhaseForSelection(params: {
  currentPhase: FloweticPhase;
  selectionType: SelectionKind;
}): FloweticPhase | null {
  const { currentPhase, selectionType } = params;

  if (currentPhase === "select_entity" && selectionType === "entity") return "recommend";
  if (currentPhase === "recommend" && selectionType === "outcome") return "align";
  if (currentPhase === "align" && selectionType === "storyboard") return "style";
  if (currentPhase === "style" && selectionType === "style_bundle") return "build_preview";

  // Later phases:
  if ((currentPhase === "interactive_edit" || currentPhase === "deploy") && selectionType === "deploy") return "deploy";

  return null;
}

function getSelectionPrompt(phase: FloweticPhase): string {
  const prompts: Record<FloweticPhase, string> = {
    select_entity: "Which workflow would you like to build a dashboard for?",
    recommend: "Would you like a Dashboard or Product outcome?",
    align: "Which storyboard template fits your needs?",
    style: "Which style bundle matches your brand?",
    build_preview: "Would you like to generate a preview now?",
    interactive_edit: "What edits would you like to make before deploying?",
    deploy: "Ready to deploy your dashboard?",
  };
  return prompts[phase] ?? "Please make a selection to continue.";
}

function getSelectionOptions(phase: FloweticPhase): string[] {
  const options: Record<FloweticPhase, string[]> = {
    select_entity: ["workflow_v2", "make_integration", "retell_ai", "n8n_automation"],
    recommend: ["dashboard", "product"],
    align: ["performance_snapshot", "impact_report", "reliability_ops", "delivery_sla"],
    style: ["healthcare_professional", "saas_modern", "ecommerce_clean", "fintech_corporate"],
    build_preview: ["generate_preview"],
    interactive_edit: ["deploy"],
    deploy: ["confirm_deploy"],
  };
  return options[phase] ?? [];
}

const phaseTransitionStep = createStep({
  id: "phaseTransition",
  description: "Deterministically detect __ACTION__ selection tokens and advance phase + persist selections in workflow state.",
  inputSchema: z.object({
    userMessage: z.string().min(1),
  }),
  outputSchema: VibeJourneyState,
  suspendSchema: VibeJourneySuspendSchema,
  resumeSchema: VibeJourneyResumeSchema,
  execute: async ({ inputData, requestContext, getInitData, resumeData, suspend }) => {
    const init = (getInitData?.() ?? {}) as {
      initialState?: Partial<VibeJourneyState>;
    };

    const initialState = (init?.initialState ?? {}) as Partial<VibeJourneyState>;

    const state: VibeJourneyState = VibeJourneyState.parse({
      ...initialState,
    });

    // Always keep RequestContext consistent with current state
    applyStateToRequestContext({ requestContext, state });

    // RESUME PATH: we were suspended and caller provides resumeData
    if (resumeData) {
      const resume = VibeJourneyResumeSchema.parse(resumeData);

      // Normalize a message into the same __ACTION__ format used by detectSelection
      const syntheticMessage = `__ACTION__:select_${resume.selectionType}:${resume.userSelection}`;
      const selection = detectSelection(syntheticMessage);

      if (!selection) {
        return await suspend({
          prompt: getSelectionPrompt(state.currentPhase),
          options: getSelectionOptions(state.currentPhase),
          error: "INVALID_RESUME_DATA: resumeData could not be parsed into a selection",
        });
      }

      // Apply to state
      if (selection.type === "entity") state.selectedEntity = selection.value;
      if (selection.type === "outcome") state.selectedOutcome = selection.value;
      if (selection.type === "storyboard") state.selectedStoryboard = selection.value;
      if (selection.type === "style_bundle") state.selectedStyleBundleId = selection.value;

      const next = nextPhaseForSelection({
        currentPhase: state.currentPhase,
        selectionType: selection.type as SelectionKind,
      });

      if (next) state.currentPhase = next;

      applyStateToRequestContext({ requestContext, state });
      return state;
    }

    // NORMAL PATH: detect selection from userMessage
    const selection = detectSelection(inputData.userMessage);

    if (!selection) {
      // Phase 5 behavior: explicitly suspend instead of returning same state (prevents looping)
      return await suspend({
        prompt: getSelectionPrompt(state.currentPhase),
        options: getSelectionOptions(state.currentPhase),
        error: `NO_SELECTION_DETECTED: expected selection for phase "${state.currentPhase}"`,
      });
    }

    // Apply selection fields
    if (selection.type === "entity") state.selectedEntity = selection.value;
    if (selection.type === "outcome") state.selectedOutcome = selection.value;
    if (selection.type === "storyboard") state.selectedStoryboard = selection.value;
    if (selection.type === "style_bundle") state.selectedStyleBundleId = selection.value;

    const next = nextPhaseForSelection({
      currentPhase: state.currentPhase,
      selectionType: selection.type as SelectionKind,
    });

    if (next) state.currentPhase = next;

    applyStateToRequestContext({ requestContext, state });
    return state;
  },
});

const agentResponseStep = createStep({
  id: "agentResponse",
  description: "Delegate response generation to masterRouterAgent using RequestContext + existing memory/network validation.",
  inputSchema: VibeJourneyState,
  outputSchema: z.object({
    text: z.string(),
    state: VibeJourneyState,
  }),
  execute: async ({ inputData, requestContext }) => {
    // Ensure RequestContext reflects current workflow state before agent runs
    applyStateToRequestContext({ requestContext, state: inputData });

    const mastra = getMastra();
    const agent = mastra.getAgent("masterRouterAgent" as const);

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND: masterRouterAgent not registered in Mastra instance");
    }

    const res = await agent.generate(inputDataToPrompt(inputData, requestContext), {
      maxSteps: 10,
      toolChoice: "auto",
      requestContext,
    });

    const text = String((res as any)?.text ?? "").trim();

    return {
      text,
      state: inputData,
    };
  },
});

function inputDataToPrompt(state: VibeJourneyState, requestContext?: RequestContext) {
  const workflowName = String((requestContext as any)?.get?.("workflowName") ?? state.workflowName ?? "").trim();
  const phase = String((requestContext as any)?.get?.("phase") ?? state.currentPhase);

  const parts = [
    `System: You are in Flowetic Vibe Journey workflow orchestration.`,
    `System: Current phase: "${phase}".`,
    workflowName ? `System: User's workflow: "${workflowName}".` : "",
    `User message:`,
  ].filter(Boolean);

  return parts.join("\n");
}

export const vibeJourneyWorkflow = createWorkflow({
  id: "vibeJourney",
  description: "Flowetic Vibe Journey orchestration workflow (Phase 4). Deterministically advances phase based on __ACTION__ selections.",
  inputSchema: VibeJourneyInput,
  outputSchema: VibeJourneyOutput,
})
  .then(
    createStep({
      id: "init",
      description: "Normalize init payload and pass through userMessage.",
      inputSchema: VibeJourneyInput,
      outputSchema: z.object({ userMessage: z.string().min(1) }),
      execute: async ({ inputData }) => ({ userMessage: inputData.userMessage }),
    }),
  )
  .then(phaseTransitionStep)
  .then(agentResponseStep)
  .then(
    createStep({
      id: "finalize",
      description: "Return final text + current workflow state.",
      inputSchema: z.object({
        text: z.string(),
        state: VibeJourneyState,
      }),
      outputSchema: VibeJourneyOutput,
      execute: async ({ inputData }) => {
        return {
          text: inputData.text,
          state: inputData.state,
        };
      },
    }),
  )
  .commit();
