
import { AbstractAgent } from "@ag-ui/client";
import { RequestContext } from "@mastra/core/request-context";
// import { createRuntimeContext, type RuntimeContextLike } from "@/mastra/lib/runtimeContext"; // Removed runtimeContext shim
import { runVibeRouter } from "@/app/api/vibe/router/runner";
import { Observable } from "rxjs";

function getOrCreateThreadId(input: any): string {
  const candidate =
    input?.threadId ||
    input?.thread?.id ||
    input?.conversationId ||
    input?.context?.threadId;

  if (typeof candidate === "string" && candidate.length > 0) return candidate;

  // Fallback: stable-ish per session
  return "thread_" + Math.random().toString(36).slice(2);
}

function getOrCreateRunId(input: any): string {
  const candidate =
    input?.runId ||
    input?.run?.id ||
    input?.context?.runId;

  if (typeof candidate === "string" && candidate.length > 0) return candidate;

  // Fallback: unique per invocation
  return "run_" + crypto.randomUUID();
}

function emit(subscriber: any, base: { threadId: string; runId: string }, event: any) {
  subscriber.next({
    ...event,
    threadId: base.threadId,
    runId: base.runId,
    timestamp: Date.now(),
  });
}

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

  // @ts-expect-error - Observable return type required by AbstractAgent interface
  // The RxJS version conflict is resolved via package.json resolutions (rxjs@7.8.1)
  // This is intentional design per line 104 comment, not a type error
  public run(input: any): Observable<any> {
    return new Observable((subscriber: any) => {
      (async () => {
        const base = {
          threadId: getOrCreateThreadId(input),
          runId: getOrCreateRunId(input),
        };

        try {
          const parsed = parseCtxEnvelope(input);
          const ctx = parsed.ctx ?? getContextFromInput(input);
          const userMessage = parsed.message;

          // RUN_STARTED
          emit(subscriber, base, { type: "RUN_STARTED" });

          if (!ctx.userId || !ctx.tenantId) {
            emit(subscriber, base, { type: "TEXT_MESSAGE_START", payload: {} });
            emit(subscriber, base, {
              type: "TEXT_MESSAGE_CONTENT",
              delta: "I'm ready, but I don't have your session context yet. Please sign in and refresh, then click Enter Vibe (or open /vibe/chat after auth).",
            });
            emit(subscriber, base, { type: "TEXT_MESSAGE_END" });
            emit(subscriber, base, { type: "RUN_FINISHED" });
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

              emit(subscriber, base, { type: "TEXT_MESSAGE_START", payload: {} });
              emit(subscriber, base, { type: "TEXT_MESSAGE_CONTENT", delta: msg });
              emit(subscriber, base, { type: "TEXT_MESSAGE_END" });
              emit(subscriber, base, { type: "RUN_FINISHED" });

              subscriber.complete();
              return;
            }
          }

          const requestContext = new RequestContext();
          requestContext.set("userId", ctx.userId);
          requestContext.set("tenantId", ctx.tenantId);
          if (ctx.vibeContext?.platformType) requestContext.set("platformType", ctx.vibeContext.platformType);

          const result = await runVibeRouter({
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            vibeContext: ctx.vibeContext,
            journey: ctx.journey,
            userMessage,
            requestContext,
          });

          const text = String(result?.text || "").trim() || "OK.";

          // Message events
          emit(subscriber, base, { type: "TEXT_MESSAGE_START", payload: {} });
          emit(subscriber, base, { type: "TEXT_MESSAGE_CONTENT", delta: text });
          emit(subscriber, base, { type: "TEXT_MESSAGE_END" });

          // If toolUi exists, emit an action/tool event that the frontend can render.
          // We keep tool UI BELOW the chat; frontend already uses useCopilotAction("displayToolUI").
          if (result?.toolUi) {
            emit(subscriber, base, {
              type: "ACTION_CALL",
              name: "displayToolUI",
              arguments: { toolUi: result.toolUi },
            });
          }

          emit(subscriber, base, { type: "RUN_FINISHED" });
          subscriber.complete();
        } catch (err: any) {
          const msg = err?.message ? String(err.message) : "Unknown error.";

          emit(subscriber, base, { type: "TEXT_MESSAGE_START", payload: {} });
          emit(subscriber, base, { type: "TEXT_MESSAGE_CONTENT", delta: msg });
          emit(subscriber, base, { type: "TEXT_MESSAGE_END" });
          emit(subscriber, base, { type: "RUN_FINISHED" });

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

export const vibeRouterAgent = new VibeRouterAgent() as any;
