
import type { AgentInput } from "@copilotkit/runtime";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { runVibeRouter } from "@/app/api/vibe/router/runner";

type VibeAgentContext = {
  userId: string;
  tenantId: string;
  vibeContext: any;
  journey?: any;
};

function getLastUserMessage(input: any): string {
  const messages = Array.isArray(input?.messages) ? input.messages : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m?.content === "string") return m.content;
  }
  return "";
}

function getContextFromInput(input: any): VibeAgentContext {
  const ctx = (input?.context ?? {}) as Partial<VibeAgentContext>;
  return {
    userId: String(ctx.userId || ""),
    tenantId: String(ctx.tenantId || ""),
    vibeContext: ctx.vibeContext ?? null,
    journey: ctx.journey ?? null,
  };
}

type FloweticJourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

function emitText(events: any, text: string) {
  events?.next?.({ type: "TEXT_MESSAGE_START", payload: {} });
  events?.next?.({ type: "TEXT_MESSAGE_CONTENT", delta: text });
  events?.next?.({ type: "TEXT_MESSAGE_END" });
}

export const vibeRouterAgent = {
  id: "vibe",
  description: "CopilotKit agent that bridges UI messages to Flowetic Vibe Router phases.",

  // IMPORTANT: public run() (not protected) to satisfy CopilotKit Agent typing
  async run(input: AgentInput, { events }: any = {}): Promise<any> {
    const ctx = getContextFromInput(input);
    const userMessage = getLastUserMessage(input);

    events?.next?.({ type: "RUN_STARTED" });

    if (!ctx.userId || !ctx.tenantId) {
      const msg = "Missing userId/tenantId in CopilotKit context.";
      emitText(events, msg);
      events?.next?.({ type: "RUN_FINISHED" });
      return { result: msg, newMessages: [] };
    }

    // Phase gating aligned with real Flowetic phases; keep adapter minimal.
    const currentMode = (ctx.journey?.mode ?? "select_entity") as FloweticJourneyMode;

    if (userMessage.startsWith("__ACTION__:")) {
      const parts = userMessage.split(":");
      const action = parts[1] || "";

      const requiredModeByAction: Record<string, FloweticJourneyMode> = {
        select_style_bundle: "style",
        interactive_edit: "interactive_edit",
        publish: "deploy",
      };

      const required = requiredModeByAction[action];
      if (required && currentMode !== required) {
        const msg = `That action isn't available yet. Current phase: "${currentMode}". Required phase: "${required}".`;
        emitText(events, msg);
        events?.next?.({ type: "RUN_FINISHED" });
        return { result: msg, newMessages: [] };
      }
    }

    const runtimeContext = new RuntimeContext();
    runtimeContext.set("userId", ctx.userId);
    runtimeContext.set("tenantId", ctx.tenantId);
    if (ctx.vibeContext?.platformType) {
      runtimeContext.set("platformType", ctx.vibeContext.platformType);
    }

    const result = await runVibeRouter({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      vibeContext: ctx.vibeContext,
      journey: ctx.journey,
      userMessage,
      runtimeContext,
    });

    const text = String(result?.text || "").trim() || "OK.";
    emitText(events, text);

    events?.next?.({ type: "RUN_FINISHED" });

    // Return toolUi in meta so the frontend can handle it via useCopilotAction if needed.
    // (We keep tool UI below the chat, not inline.)
    return {
      result: text,
      newMessages: [],
      meta: {
        toolUi: result?.toolUi ?? null,
        journey: result?.journey ?? null,
        interfaceId: result?.interfaceId ?? null,
        previewUrl: result?.previewUrl ?? null,
        previewVersionId: result?.previewVersionId ?? null,
      },
    };
  },
} as const;
