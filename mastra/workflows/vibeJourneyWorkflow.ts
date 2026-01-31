import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { RequestContext } from "@mastra/core/request-context";
import { detectSelection } from "../validation/selection-checks";

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
  selectionType: ReturnType<typeof detectSelection>["type"];
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

const phaseTransitionStep = createStep({
  id: "phaseTransition",
  description: "Deterministically detect __ACTION__ selection tokens and advance phase + persist selections in workflow state.",
  inputSchema: z.object({
    userMessage: z.string().min(1),
  }),
  outputSchema: VibeJourneyState,
  execute: async ({ inputData, requestContext, getInitData }) => {
    // initialState is injected at run.start() time; we read it via getInitData() pattern
    const init = (getInitData?.() ?? {}) as {
      initialState?: Partial<VibeJourneyState>;
    };

    const initialState = (init?.initialState ?? {}) as Partial<VibeJourneyState>;

    // Normalize into full state object
    const state: VibeJourneyState = VibeJourneyState.parse({
      ...initialState,
    });

    const selection = detectSelection(inputData.userMessage);

    if (!selection) {
      // No state change; just ensure RequestContext has the current phase for downstream agent prompt
      applyStateToRequestContext({ requestContext, state });
      return state;
    }

    // Update selection fields
    if (selection.type === "entity") state.selectedEntity = selection.value;
    if (selection.type === "outcome") state.selectedOutcome = selection.value;
    if (selection.type === "storyboard") state.selectedStoryboard = selection.value;
    if (selection.type === "style_bundle") state.selectedStyleBundleId = selection.value;

    // Phase transition if valid
    const next = nextPhaseForSelection({
      currentPhase: state.currentPhase,
      selectionType: selection.type,
    });

    if (next) state.currentPhase = next;

    // Push state into RequestContext so the agent sees authoritative phase + selections
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
  execute: async ({ inputData, requestContext, context }) => {
    // Ensure RequestContext reflects current workflow state before agent runs
    applyStateToRequestContext({ requestContext, state: inputData });

    const mastra = (context as any)?.mastra;
    const agent = mastra?.getAgent?.("masterRouterAgent" as const);

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND: masterRouterAgent not registered in Mastra instance");
    }

    // Use the same deterministic network validation path already wired into runNetwork.ts
    // But here we call agent.generate directly for Phase 4; the router route will use workflow for transitions.
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
