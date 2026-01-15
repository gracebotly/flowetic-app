
import { AbstractAgent } from "@ag-ui/client";

import { RuntimeContext } from "@mastra/core/runtime-context";
import { runVibeRouter } from "@/app/api/vibe/router/runner";
import { Observable } from "rxjs";

type VibeAgentContext = {
  userId: string;
  tenantId: string;
  vibeContext: any;
  journey?: any;
};

type FloweticJourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

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

function parseCtxEnvelope(input: any): { ctx: any; message: string } {
  const raw = getLastUserMessage(input);
  if (!raw.startsWith("__FLOWETIC_CTX__:")) return { ctx: null, message: raw };

  const idx = raw.indexOf("\n");
  if (idx === -1) return { ctx: null, message: raw };

  const header = raw.slice(0, idx);
  const body = raw.slice(idx + 1);

  const jsonStr = header.replace("__FLOWETIC_CTX__:", "");
  try {
    const ctx = JSON.parse(jsonStr);
    return { ctx, message: body };
  } catch {
    return { ctx: null, message: raw };
  }
}

class VibeRouterAgent extends AbstractAgent {
  constructor() {
    super({
      agentId: "vibe",
      description: "CopilotKit agent that bridges UI messages to Flowetic Vibe Router phases.",
    });
  }

  // IMPORTANT: run() returns Observable (not Promise) to satisfy CopilotKit Agent typing
  public run(input: any): Observable<any> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          const parsed = parseCtxEnvelope(input);
          const ctx = parsed.ctx ?? getContextFromInput(input);
          const userMessage = parsed.message;

          // RUN_STARTED
          this.events$.next({ type: "RUN_STARTED" });

          if (!ctx.userId || !ctx.tenantId) {
            this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
            this.events$.next({
              type: "TEXT_MESSAGE_CONTENT",
              delta: "I'm ready, but I don't have your session context yet. Please sign in and refresh, then click Enter Vibe (or open /vibe/chat after auth).",
            });
            this.events$.next({ type: "TEXT_MESSAGE_END" });
            this.events$.next({ type: "RUN_FINISHED" });
            subscriber.complete();
            return;
          }

          // Phase gating aligned to Flowetic real phases
          const currentMode = (ctx.journey?.mode ?? "select_entity") as
            | "select_entity"
            | "recommend"
            | "align"
            | "style"
            | "build_preview"
            | "interactive_edit"
            | "deploy";

          if (userMessage.startsWith("__ACTION__:")) {
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

              subscriber.complete();
              return;
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

          // Message events
          this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
          this.events$.next({ type: "TEXT_MESSAGE_CONTENT", delta: text });
          this.events$.next({ type: "TEXT_MESSAGE_END" });

          // If toolUi exists, emit an action/tool event that the frontend can render.
          // We keep tool UI BELOW the chat; frontend already uses useCopilotAction("displayToolUI").
          if (result?.toolUi) {
            this.renderToolUi("displayToolUI", { toolUi: result.toolUi });
          }

          this.events$.next({ type: "RUN_FINISHED" });
          subscriber.complete();
        } catch (err: any) {
          const msg = err?.message ? String(err.message) : "Unknown error.";

          this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
          this.events$.next({ type: "TEXT_MESSAGE_CONTENT", delta: msg });
          this.events$.next({ type: "TEXT_MESSAGE_END" });
          this.events$.next({ type: "RUN_FINISHED" });

          subscriber.complete();
        }
      })();

      return () => {
        // teardown no-op
      };
    });
  }

  public async detachActiveRun(): Promise<void> {
    // no-op
  }
}

export const vibeRouterAgent = new VibeRouterAgent();
