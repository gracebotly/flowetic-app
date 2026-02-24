import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RequestContext } from "@mastra/core/request-context";
import { detectSelection } from "../validation/selection-checks";
import { getMastra } from "../index";

// "storyboard" removed — no longer a valid selection kind
type SelectionKind = "proposal" | "deploy";

const VibeJourneySuspendSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  error: z.string().optional(),
});

const VibeJourneyResumeSchema = z.object({
  userSelection: z.string().min(1),
  selectionType: z.enum(["proposal", "deploy"]),
});

// "align" removed from phase list
const FloweticPhase = z.enum([
  "propose",
  "build_edit",
  "deploy",
]);
export type FloweticPhase = z.infer<typeof FloweticPhase>;

export const VibeJourneyInput = z.object({
  userMessage: z.string().min(1),
});

export const VibeJourneyState = z.object({
  currentPhase: FloweticPhase.default("propose"),

  // Selections tracked across phases (storyboard removed):
  selectedEntity: z.string().optional(),
  selectedOutcome: z.string().optional(),
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
  if (state.selectedStyleBundleId) safeSetRequestContext(requestContext, "selectedStyleBundleId", state.selectedStyleBundleId);
}

/**
 * Phase transitions:
 *   propose   + proposal → build_edit
 *   build_edit + deploy  → deploy
 */
function nextPhaseForSelection(params: {
  currentPhase: FloweticPhase;
  selectionType: SelectionKind;
}): FloweticPhase | null {
  const { currentPhase, selectionType } = params;

  if (currentPhase === "propose" && selectionType === "proposal") return "build_edit";
  if (currentPhase === "build_edit" && selectionType === "deploy") return "deploy";

  return null;
}


function getSelectionPrompt(phase: FloweticPhase): string {
  const prompts: Record<FloweticPhase, string> = {
    propose: "Which proposal do you prefer?",
    build_edit: "What edits would you like to make?",
    deploy: "Ready to deploy?",
  };
  return prompts[phase] ?? "Please make a selection to continue.";
}


function getSelectionOptions(phase: FloweticPhase): string[] {
  const options: Record<FloweticPhase, string[]> = {
    propose: [],
    build_edit: ["deploy"],
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

    // RESUME PATH
    if (resumeData) {
      const resume = VibeJourneyResumeSchema.parse(resumeData);

      const syntheticMessage = `__ACTION__:select_${resume.selectionType}:${resume.userSelection}`;
      const selection = detectSelection(syntheticMessage);

      if (!selection) {
        return await suspend({
          prompt: getSelectionPrompt(state.currentPhase),
          options: getSelectionOptions(state.currentPhase),
          error: "INVALID_RESUME_DATA: resumeData could not be parsed into a selection",
        });
      }

      if (selection.type === "proposal") state.selectedOutcome = selection.value;

      const next = nextPhaseForSelection({
        currentPhase: state.currentPhase,
        selectionType: selection.type as SelectionKind,
      });

      if (next) state.currentPhase = next;

      applyStateToRequestContext({ requestContext, state });
      return state;
    }

    // NORMAL PATH
    const selection = detectSelection(inputData.userMessage);

    if (!selection) {
      return await suspend({
        prompt: getSelectionPrompt(state.currentPhase),
        options: getSelectionOptions(state.currentPhase),
        error: `NO_SELECTION_DETECTED: expected selection for phase "${state.currentPhase}"`,
      });
    }

    if (selection.type === "proposal") state.selectedOutcome = selection.value;

    // Legacy: if someone sends a storyboard selection, just ignore it and don't block
    // (forward-compatible with old UI versions that might still emit storyboard tokens)

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
  description: "Flowetic Vibe Journey orchestration workflow. Deterministically advances phase based on __ACTION__ selections. Flow: select_entity → recommend → style → build_preview → interactive_edit → deploy.",
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
