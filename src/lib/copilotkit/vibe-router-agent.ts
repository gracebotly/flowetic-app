
import { AbstractAgent, AGUIEvent } from "@ag-ui/client";
import { RequestContext } from "@mastra/core/request-context";
import { runVibeRouter } from "@/app/api/vibe/router/runner";
import { Observable } from "rxjs";
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from "@mastra/core/request-context";

function generateMessageId(): string {
  return `msg_${crypto.randomUUID()}`;
}

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

function emit(
  subscriber: any,
  base: { threadId: string; runId: string; messageId: string },
  event: any
) {
  const eventWithRequired = {
    ...event,
    threadId: base.threadId,
    runId: base.runId,
    timestamp: Date.now(),
  };

  // Add messageId to message-related events
  if (
    event.type === "TEXT_MESSAGE_START" ||
    event.type === "TEXT_MESSAGE_CONTENT" ||
    event.type === "TEXT_MESSAGE_END"
  ) {
    eventWithRequired.messageId = base.messageId;
  }

  subscriber.next(eventWithRequired);
}

type VibeAgentContext = {
  userId: string;
  tenantId: string;
  vibeContext: any;
  journey?: any;
  selectedModel?: any;
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
    selectedModel: ctx.selectedModel,
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

  // Observable return type required by AbstractAgent interface
  // RxJS version pinned to 7.8.1 in package.json resolutions
  public run(input: any): Observable<AGUIEvent> {
    return new Observable((subscriber: any) => {
      (async () => {
        const base = {
          threadId: getOrCreateThreadId(input),
          runId: getOrCreateRunId(input),
          messageId: generateMessageId(),
        };

        try {
          // STEP 1: RUN_STARTED (required first event)
          emit(subscriber, base, { type: "RUN_STARTED" });

          const parsed = parseCtxEnvelope(input);
          const ctx = parsed.ctx ?? getContextFromInput(input);
          const userMessage = parsed.message;

          // STEP 2: TEXT_MESSAGE_START (required before content)
          emit(subscriber, base, {
            type: "TEXT_MESSAGE_START",
            payload: { messageId: base.messageId },
          });

          if (!ctx.userId || !ctx.tenantId) {
            emit(subscriber, base, {
              type: "TEXT_MESSAGE_CONTENT",
              delta: "I'm ready, but I don't have your session context yet. Please sign in and refresh, then click Enter Vibe (or open /vibe/chat after auth).",
              messageId: base.messageId,
            });
            emit(subscriber, base, {
              type: "TEXT_MESSAGE_END",
              messageId: base.messageId,
            });
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

              emit(subscriber, base, {
                type: "TEXT_MESSAGE_CONTENT",
                delta: msg,
                messageId: base.messageId,
              });
              emit(subscriber, base, {
                type: "TEXT_MESSAGE_END",
                messageId: base.messageId,
              });

              subscriber.complete();
              return;
            }
          }

          const requestContext = new RequestContext();
          requestContext.set("userId", ctx.userId);
          requestContext.set("tenantId", ctx.tenantId);
          if (ctx.vibeContext?.platformType) requestContext.set("platformType", ctx.vibeContext.platformType);
          if (ctx.selectedModel) requestContext.set("selectedModel", ctx.selectedModel);

          // Add journey state properties to RequestContext for agent awareness
          if (ctx.journey?.selectedOutcome) requestContext.set("selectedOutcome", ctx.journey.selectedOutcome);
          if (ctx.journey?.selectedStoryboard) requestContext.set("selectedStoryboard", ctx.journey.selectedStoryboard);
          if (ctx.journey?.mode) requestContext.set("phase", ctx.journey.mode);

          // Add workflow name from vibeContext for agent instructions
          if (ctx.vibeContext?.displayName || ctx.vibeContext?.externalId) {
            requestContext.set("workflowName", String(ctx.vibeContext.displayName ?? ctx.vibeContext.externalId ?? "").trim());
          }

          // Set reserved keys for secure memory operations
          requestContext.set(MASTRA_RESOURCE_ID_KEY, ctx.tenantId);
          requestContext.set(MASTRA_THREAD_ID_KEY, ctx.journey?.threadId || ctx.journey?.mastraThreadId || ctx.threadId || "");

          const result = await runVibeRouter({
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            vibeContext: ctx.vibeContext,
            journey: ctx.journey,
            userMessage,
            requestContext,
          });

          const text = String(result?.text || "").trim() || "OK.";

          // Message events (TEXT_MESSAGE_START already emitted above)
          emit(subscriber, base, {
            type: "TEXT_MESSAGE_CONTENT",
            delta: text,
            messageId: base.messageId,
          });
          emit(subscriber, base, {
            type: "TEXT_MESSAGE_END",
            messageId: base.messageId,
          });

          // If toolUi exists, emit an action/tool event that the frontend can render.
          if (result?.toolUi) {
            emit(subscriber, base, {
              type: "ACTION_CALL",
              name: "displayToolUI",
              arguments: { toolUi: result.toolUi },
            });
          }
          
          subscriber.complete();
        } catch (err: any) {
          const raw = err?.message ? String(err.message) : "Unknown error.";
          const codeFromDetails =
            typeof err?.details?.code === "string" ? err.details.code : undefined;

          const isConcurrency =
            raw === "LLM_CONCURRENCY_LIMIT" ||
            codeFromDetails === "LLM_CONCURRENCY_LIMIT" ||
            raw.toLowerCase().includes("high concurrency") ||
            raw.toLowerCase().includes("rate limit") ||
            raw.toLowerCase().includes("429");

          const msg = isConcurrency
            ? "Our AI service is temporarily overloaded. Please wait ~10 seconds and try again."
            : raw;

          // For error path: emit START → CONTENT → END sequence
          const errorMessageId = generateMessageId();
          emit(subscriber, { ...base, messageId: errorMessageId }, {
            type: "TEXT_MESSAGE_START",
            payload: { messageId: errorMessageId },
          });
          emit(subscriber, { ...base, messageId: errorMessageId }, {
            type: "TEXT_MESSAGE_CONTENT",
            delta: msg,
            messageId: errorMessageId,
          });
          emit(subscriber, { ...base, messageId: errorMessageId }, {
            type: "TEXT_MESSAGE_END",
            messageId: errorMessageId,
          });

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
