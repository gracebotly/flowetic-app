
import { POST as vibeRouterPOST } from "./route";

/**
 * Runner that reuses existing Next.js route handler without HTTP.
 * IMPORTANT: It must forward requestContext because the agent sets reserved keys
 * and journey state there (selectedOutcome, phase, workflowName, etc).
 */
export async function runVibeRouter(args: {
  userId: string;
  tenantId: string;
  vibeContext: any;
  journey: any;
  userMessage: string;
  selectedModel?: string; // ✅ Add this parameter
  requestContext?: any;
}) {
  const requestContextEntries: Array<[string, unknown]> = [];

  const rc = args.requestContext as any;
  if (rc && typeof rc === "object") {
    // Try common internal shapes first
    const internalMap = (rc as any).context ?? (rc as any)._context ?? null;

    if (internalMap && typeof internalMap === "object") {
      for (const [k, v] of Object.entries(internalMap)) {
        if (typeof v === "function") continue;
        requestContextEntries.push([String(k), v]);
      }
    } else {
      // Fallback: enumerable props
      for (const [k, v] of Object.entries(rc)) {
        if (typeof v === "function") continue;
        requestContextEntries.push([String(k), v]);
      }
    }
  }

  const body = {
    userId: args.userId,
    tenantId: args.tenantId,
    vibeContext: args.vibeContext,
    journey: args.journey,
    userMessage: args.userMessage,
    selectedModel: args.selectedModel, // ✅ Include selectedModel
    __requestContextEntries: requestContextEntries,
  };

  const req = {
    json: async () => body,
  } as any;

  const res = await vibeRouterPOST(req);

  const text = await (res as Response).text();
  const parsed = JSON.parse(text);

  if (!(res as Response).ok) {
    const err = parsed?.error || "VIBE_ROUTER_FAILED";
    const details = parsed?.details;
    const e: any = new Error(err);
    e.details = details;
    e.status = (res as Response).status;
    throw e;
  }

  return parsed;
}
