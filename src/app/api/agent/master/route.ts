import { NextRequest, NextResponse } from "next/server";
// import { RequestContext } from "@mastra/core/request-context"; // Removed - invalid import
import { createClient } from "@/lib/supabase/server";
import { getMastra } from "@/mastra";
import { ensureMastraThreadId } from "@/mastra/lib/ensureMastraThread";
import { runAgentNetworkToText } from "@/mastra/lib/runNetwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeParseErrorObject(obj: unknown): string {
  if (typeof obj !== "object" || obj === null) return String(obj);

  try {
    const stringified = JSON.stringify(obj);
    if (stringified === "{}") return String(obj);
    return stringified;
  } catch {
    return String(obj);
  }
}

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError | unknown;
} & Record<string, any>;

type SerializableError = Error & {
  toJSON: () => SerializedError;
};

function getErrorFromUnknown(
  unknownErr: unknown,
  options: {
    fallbackMessage?: string;
    maxDepth?: number;
    supportSerialization?: boolean;
    serializeStack?: boolean;
  } = {},
): SerializableError {
  const merged = {
    fallbackMessage: "Unknown error",
    maxDepth: 5,
    supportSerialization: true,
    serializeStack: true,
    ...options,
  };

  const { fallbackMessage, maxDepth, supportSerialization, serializeStack } = merged;

  const addErrorToJSON = (
    error: Error,
    serializeStackLocal: boolean,
    opts?: { maxDepth?: number; currentDepth?: number },
  ) => {
    const maxDepthLocal = opts?.maxDepth ?? 5;
    const currentDepth = opts?.currentDepth ?? 0;

    if ((error as any).toJSON) return;

    if (error.cause instanceof Error && currentDepth < maxDepthLocal) {
      addErrorToJSON(error.cause, serializeStackLocal, { maxDepth: maxDepthLocal, currentDepth: currentDepth + 1 });
    }

    Object.defineProperty(error, "toJSON", {
      value: function (this: Error) {
        const json: SerializedError = { message: this.message, name: this.name };
        if (serializeStackLocal && this.stack !== undefined) json.stack = this.stack;

        if (this.cause !== undefined) {
          const c: any = this.cause;
          if (c instanceof Error && typeof (c as any).toJSON === "function") json.cause = (c as any).toJSON();
          else json.cause = this.cause;
        }

        const anyErr = this as any;
        for (const key in anyErr) {
          if (Object.prototype.hasOwnProperty.call(anyErr, key) && !(key in json) && key !== "toJSON") {
            (json as any)[key] = anyErr[key];
          }
        }

        return json;
      },
      enumerable: false,
      writable: true,
      configurable: true,
    });
  };

  if (unknownErr instanceof Error) {
    if (supportSerialization) addErrorToJSON(unknownErr, serializeStack, { maxDepth });
    return unknownErr as SerializableError;
  }

  let err: Error;

  if (unknownErr && typeof unknownErr === "object") {
    const msg =
      "message" in (unknownErr as any) && typeof (unknownErr as any).message === "string"
        ? String((unknownErr as any).message)
        : safeParseErrorObject(unknownErr);

    const causeRaw = "cause" in (unknownErr as any) ? (unknownErr as any).cause : undefined;

    let cause: any = undefined;
    if (causeRaw !== undefined && maxDepth > 0) {
      cause = causeRaw instanceof Error ? causeRaw : getErrorFromUnknown(causeRaw, { ...merged, maxDepth: maxDepth - 1 });
    }

    err = new Error(msg, cause ? { cause } : undefined);
    Object.assign(err as any, unknownErr);
    err.stack = "stack" in (unknownErr as any) && typeof (unknownErr as any).stack === "string" ? (unknownErr as any).stack : undefined;
  } else if (typeof unknownErr === "string") {
    err = new Error(unknownErr);
    err.stack = undefined;
  } else {
    err = new Error(fallbackMessage);
  }

  if (supportSerialization) addErrorToJSON(err, serializeStack, { maxDepth });

  return err as SerializableError;
}

function detectIntent(message: string) {
  const m = message.toLowerCase();

  const wantsPreview =
    m.includes("preview") ||
    m.includes("generate preview") ||
    m.includes("generate a preview") ||
    m.includes("create a preview") ||
    m.includes("build a preview") ||
    m.includes("generate dashboard") ||
    m.includes("create dashboard") ||
    m.includes("build dashboard");

  const wantsMapping =
    m.includes("mapping") ||
    m.includes("map ") ||
    m.includes("template") ||
    m.includes("recommend template") ||
    m.includes("best template");

  return { wantsPreview, wantsMapping };
}

export async function POST(req: NextRequest) {
  const mastra = getMastra();
  const supabase = await createClient();

  try {
    const body = await req.json().catch(() => ({} as any));

    const action = String(body?.action || "message");
    const workflowAction = String(body?.workflowAction || "");
    const workflowRunId = typeof body?.runId === "string" ? body.runId : undefined;
    const workflowStep = typeof body?.step === "string" ? body.step : undefined;
    const resumeData = body?.resumeData as
      | { userSelection: string; selectionType: "entity" | "outcome" | "style_bundle" }
      | undefined;

    // Message can come from either shape
    const message =
      (body.message as string | undefined) ??
      (body.lastMessage as string | undefined) ??
      (body.messages?.[body.messages.length - 1]?.content as string | undefined) ??
      "";

    // Handle initialize action
    if (action === "initialize") {
      const ctx = body?.context || {};
      const displayName = String(ctx?.displayName || "");
      const platformType = String(ctx?.platformType || "");

      return NextResponse.json({
        type: "success",
        message: displayName
          ? `I see you selected "${displayName}" on ${platformType}. What would you like to build—an analytics dashboard, a tool, or a form?`
          : `What would you like to build—an analytics dashboard, a tool, or a form?`,
      });
    }

    // 1) Resolve authenticated userId
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AUTH_REQUIRED",
          message: "Please sign in to continue.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    // 2) Resolve tenantId from memberships
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership?.tenant_id) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "TENANT_ACCESS_DENIED",
          message: "No tenant membership found for this user.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const tenantId = membership.tenant_id as string;
    const userRole = (membership.role ?? "admin") as "admin" | "client" | "viewer";

    // 3) Resolve sourceId + platformType
    // Allow body.sourceId/platformType only if they look like real values; otherwise ignore.
    const bodySourceId = typeof body.sourceId === "string" ? body.sourceId : undefined;
    const bodyPlatformType = typeof body.platformType === "string" ? body.platformType : undefined;

    let sourceId = bodySourceId;
    let platformType = bodyPlatformType;

    if (!sourceId) {
      const { data: source, error: sourceError } = await supabase
        .from("sources")
        .select("id,type,status,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sourceError || !source?.id) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "CONNECTION_NOT_CONFIGURED",
            message: "No platform source is connected yet. Go to Sources and connect a platform first.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      sourceId = source.id;
      platformType = platformType ?? source.type ?? "other";
    }

    if (!platformType) platformType = "other";

    // ThreadId: allow body.threadId if present, else derive a stable fallback
    const threadId =
      (typeof body.threadId === "string" && body.threadId.trim()) ||
      `thread-${tenantId}`;

    // 4) Build runtimeContext with real IDs (plain object instead of RequestContext)
    const runtimeContext = {
      tenantId,
      userId,
      userRole,
      sourceId,
      platformType,
      threadId,
      get: (key: string) => {
        const obj: any = { tenantId, userId, userRole, sourceId, platformType, threadId };
        return obj[key];
      }
    } as any;

    // 4a) Dedicated workflow handler
    if (workflowAction === "vibeJourney") {
      try {
        const workflow = mastra.getWorkflow("vibeJourney" as const);
        if (!workflow) {
          return new Response(
            JSON.stringify({ type: "error", code: "WORKFLOW_NOT_FOUND", message: "vibeJourney workflow not registered." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Resume path
        if (workflowRunId && workflowStep && resumeData) {
          const run = await workflow.createRun({ runId: workflowRunId } as any);
          const result = await (run as any).resume({
            step: workflowStep,
            resumeData,
          });

          if (result.status === "success") {
            return new Response(
              JSON.stringify({
                type: "success",
                status: "success",
                text: String((result.result as any)?.text ?? ""),
                state: (result.result as any)?.state ?? {},
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          }

          if (result.status === "suspended") {
            return new Response(
              JSON.stringify({
                type: "suspended",
                status: "suspended",
                runId: workflowRunId,
                step: result.suspended?.[0],
                suspendPayload: result.suspendPayload ?? null,
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          }

          if (result.status === "failed") {
            return new Response(
              JSON.stringify({
                type: "error",
                code: "WORKFLOW_FAILED",
                message: result.error?.message || "Workflow execution failed",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          if (result.status === "tripwire") {
            return new Response(
              JSON.stringify({
                type: "error",
                code: "WORKFLOW_TRIPWIRE",
                message: result.tripwire?.reason || "Request blocked by workflow tripwire.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              type: "error",
              code: "WORKFLOW_UNEXPECTED_STATUS",
              message: `Unexpected workflow status: ${String((result as any).status)}`,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Start path
        const run = await workflow.createRun();
        const result = await run.start({
          inputData: { userMessage: message || " " },
          requestContext: runtimeContext,
          initialState: {
            currentPhase: "select_entity",
            platformType: String(platformType || "other"),
            workflowName: "",
          },
        } as any);

        if (result.status === "success") {
          return new Response(
            JSON.stringify({
              type: "success",
              status: "success",
              text: String((result.result as any)?.text ?? ""),
              state: (result.result as any)?.state ?? {},
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        if (result.status === "suspended") {
          return new Response(
            JSON.stringify({
              type: "suspended",
              status: "suspended",
              runId: (run as any).runId,
              step: result.suspended?.[0],
              suspendPayload: result.suspendPayload ?? null,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        if (result.status === "failed") {
          return new Response(
            JSON.stringify({
              type: "error",
              code: "WORKFLOW_FAILED",
              message: result.error?.message || "Workflow execution failed",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        if (result.status === "tripwire") {
          return new Response(
            JSON.stringify({
              type: "error",
              code: "WORKFLOW_TRIPWIRE",
              message: result.tripwire?.reason || "Request blocked by workflow tripwire.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            type: "error",
            code: "WORKFLOW_UNEXPECTED_STATUS",
            message: `Unexpected workflow status: ${String((result as any).status)}`,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      } catch (err: unknown) {
        const e = getErrorFromUnknown(err, { fallbackMessage: "Workflow error", supportSerialization: true });
        console.error("[/api/agent/master][vibeJourney] error", e);

        return new Response(
          JSON.stringify({
            type: "error",
            code: "WORKFLOW_ERROR",
            message: e.message,
            details: (e as any).toJSON ? (e as any).toJSON() : undefined,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // 5) Always start with Master Router
    const master = mastra.getAgent("masterRouterAgent" as const);
    if (!master) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AGENT_NOT_FOUND",
          message: "masterRouterAgent not registered.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const { wantsPreview, wantsMapping } = detectIntent(message);

    // NO_ROADMAP_RULES: Guard against.agent explaining the process
    if (message.toLowerCase().includes("phase") || 
        message.toLowerCase().includes("step") || 
        message.toLowerCase().includes("roadmap") ||
        message.toLowerCase().includes("process")) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "NO_ROADMAP_RULES",
          message: "Let's focus on what you want to build right now, not the process. Which outcome matters most to you?",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ENFORCE STYLE_BEFORE_PREVIEW
    if (wantsPreview || wantsMapping) {
      const { data: threads } = await supabase
        .from("assistant_threads")
        .select("messages")
        .eq("tenant_id", tenantId)
        .eq("thread_id", threadId)
        .maybeSingle();

      const messages = threads?.messages || [];
      const hasSelectedStyle = messages.some((msg: any) => 
        msg.content?.includes("selected_style") || 
        msg.tool_call?.includes("select_style_bundle") ||
        msg.role === "assistant" && msg.content?.toLowerCase().includes("style")
      );

      if (!hasSelectedStyle) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "STYLE_REQUIRED_FIRST",
            message: "Hey! We need to pick a style before generating a preview. Choose one of the style pack options on the right.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    if (wantsPreview || wantsMapping) {
      const mastraThreadId = await ensureMastraThreadId({
        tenantId,
        journeyThreadId: threadId,
        resourceId: userId,
        title: "Flowetic Vibe",
      });

      const { text } = await runAgentNetworkToText({
        agent: master as any,
        message,
        requestContext: runtimeContext,
        memory: {
          resource: String(userId),
          thread: String(mastraThreadId),
        },
        maxSteps: 10, // Enable autonomous multi-step execution
      });

      return new Response(
        JSON.stringify({
          type: "success",
          agentKey: "masterRouterAgent.network",
          text: text || "",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Use ensureMastraThreadId to get Mastra thread ID for router-only call
    const mastraThreadId = await ensureMastraThreadId({
      tenantId,
      journeyThreadId: threadId,
      resourceId: userId,
      title: "Flowetic Vibe",
    });

    const routerOnly = await master.generate(message, {
      maxSteps: 10, // Enable autonomous multi-step execution
      toolChoice: "auto",
      requestContext: runtimeContext,
      memory: {
        resource: String(userId),
        thread: String(mastraThreadId),
      },
    });

    return new Response(
      JSON.stringify({
        type: "success",
        agentKey: "masterRouterAgent",
        text: routerOnly.text ?? "",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[/api/agent/master] error", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        type: "error",
        code: "UNKNOWN_ERROR",
        message: "Something went wrong. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
