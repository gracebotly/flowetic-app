
import { RequestContext } from "@mastra/core/runtime-context";
import { POST as vibeRouterPOST } from "./route";

// This runner reuses the existing route handler without HTTP.
// It constructs a minimal NextRequest-like object that provides json().
export async function runVibeRouter(args: {
  userId: string;
  tenantId: string;
  vibeContext: any;
  journey: any;
  userMessage: string;
  requestContext: RequestContext;
}) {
  const body = {
    userId: args.userId,
    tenantId: args.tenantId,
    vibeContext: args.vibeContext,
    journey: args.journey,
    userMessage: args.userMessage,
  };

  // Create a minimal stub request object compatible with the route's POST(req)
  const req = {
    json: async () => body,
  } as any;

  const res = await vibeRouterPOST(req);

  // NextResponse has .json() only on the client; on server it's a Response.
  const text = await (res as Response).text();
  const parsed = JSON.parse(text);

  if (!(res as Response).ok) {
    const err = parsed?.error || "VIBE_ROUTER_FAILED";
    throw new Error(err);
  }

  return parsed;
}
