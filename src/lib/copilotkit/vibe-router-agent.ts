
import { AbstractAgent } from "@ag-ui/client";
import type { AgentInput } from "@copilotkit/runtime";
import { RuntimeContext } from "@mastra/core/runtime-context";

// Import the existing Vibe router handler logic directly (do NOT call over HTTP)
import { runVibeRouter } from "@/app/api/vibe/router/runner";

// NOTE: If the repo does not have a runner yet, create one in step 2b below.

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
  // CopilotKit lets you pass custom context; we standardize it.
  // If not provided, we fail with a clear message.
  const ctx = (input?.context ?? {}) as Partial<VibeAgentContext>;
  return {
    userId: String(ctx.userId || ""),
    tenantId: String(ctx.tenantId || ""),
    vibeContext: ctx.vibeContext ?? null,
    journey: ctx.journey ?? null,
  };
}

class VibeRouterAgent extends AbstractAgent {
  constructor() {
    super({
      agentId: "vibe",
      description: "CopilotKit agent that bridges UI messages to Flowetic Vibe Router phases.",
    });
  }

  protected async run(input: AgentInput): Promise<any> {
    const ctx = getContextFromInput(input);
    const userMessage = getLastUserMessage(input);

    if (!ctx.userId || !ctx.tenantId) {
      const msg = "Missing userId/tenantId in CopilotKit context.";
      this.events$.next({ type: "RUN_STARTED" });
      this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
      this.events$.next({ type: "TEXT_MESSAGE_CONTENT", delta: msg });
      this.events$.next({ type: "TEXT_MESSAGE_END" });
      this.events$.next({ type: "RUN_FINISHED" });
      return { result: msg, newMessages: [] };
    }

    this.events$.next({ type: "RUN_STARTED" });

    // Phase gating: keep adapter minimal and aligned with real Flowetic phases.
    // Source of truth still lives in /api/vibe/router (Master Router Agent).
    const currentMode = (ctx.journey?.mode ?? "select_entity") as
      | "select_entity"
      | "recommend"
      | "align"
      | "style"
      | "build_preview"
      | "interactive_edit"
      | "deploy";

    if (userMessage.startsWith("__ACTION__:")) {
      // Format examples:
      // "__ACTION__:select_style_bundle:<bundleId>"
      // "__ACTION__:interactive_edit:{...json...}"
      const parts = userMessage.split(":");
      const action = parts[1] || "";

      const requiredModeByAction: Record<string, typeof currentMode> = {
        select_style_bundle: "style",
        interactive_edit: "interactive_edit",
        publish: "deploy",
      };

      const required = requiredModeByAction[action];
      if (required && currentMode !== required) {
        const msg = `That action isn't available yet. Current phase: "${currentMode}". Required phase: "${required}".`;

        this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
        this.events$.next({ type: "TEXT_MESSAGE_CONTENT", delta: msg });
        this.events$.next({ type: "TEXT_MESSAGE_END" });
        this.events$.next({ type: "RUN_FINISHED" });

        return { result: msg, newMessages: [] };
      }
    }

    // Call existing Vibe router logic
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("userId", ctx.userId);
    runtimeContext.set("tenantId", ctx.tenantId);
    if (ctx.vibeContext?.platformType) runtimeContext.set("platformType", ctx.vibeContext.platformType);

    const result = await runVibeRouter({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      vibeContext: ctx.vibeContext,
      journey: ctx.journey,
      userMessage,
      runtimeContext,
    });

    const text = String(result?.text || "").trim() || "OK.";

    // Emit CopilotKit message events
    this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
    this.events$.next({ type: "TEXT_MESSAGE_CONTENT", delta: text });
    this.events$.next({ type: "TEXT_MESSAGE_END" });
    this.events$.next({ type: "RUN_FINISHED" });

    // Use CopilotKit's renderer to display tool UI if present
    if (result?.toolUi) {
      this.renderToolUi("displayToolUI", { toolUi: result.toolUi });
    }

    return {
      result: text,
      newMessages: [],
      meta: null, // We used the renderer instead
    };
  }

  protected detachActiveRun(): void {
    // no-op
  }
}

export const vibeRouterAgent = new VibeRouterAgent();
