import { NextResponse } from "next/server";

/**
 * Standard API error shape — matches errorResponse() in connections/connect.
 *
 * Frontend checks: `!res.ok || !json?.ok` then reads `json?.message`, `json?.code`
 * Some flows also read `json?.details` and `json?.userAction`.
 */
type ApiErrorBody = {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  userAction?: "fix_credentials" | "retry_later" | "contact_support";
};

type JsonLikeRecord = Record<string, unknown>;
type ApiHandler<TArgs extends unknown[]> = (...args: TArgs) => Promise<Response>;

/**
 * Best-effort tenant ID extraction for error logging.
 * Attempts to read from a cloned request body (POST/PUT/PATCH/DELETE).
 * Never throws — returns "unknown" if extraction fails.
 */
async function extractTenantHint(req: Request): Promise<string> {
  try {
    if (req.method === "GET" || req.method === "HEAD") {
      const url = new URL(req.url);
      return url.searchParams.get("tenant_id") || "unknown";
    }
    // Clone so the original body remains consumable by the handler
    const clone = req.clone();
    const body: unknown = await clone.json();
    if (!body || typeof body !== "object") {
      return "unknown";
    }
    const jsonBody = body as JsonLikeRecord;
    const tenantId = jsonBody.tenantId;
    if (typeof tenantId === "string" && tenantId.length > 0) {
      return tenantId;
    }
    const snakeTenantId = jsonBody.tenant_id;
    if (typeof snakeTenantId === "string" && snakeTenantId.length > 0) {
      return snakeTenantId;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Wraps a Next.js API route handler in a top-level try/catch.
 *
 * On unhandled exceptions:
 *  - Logs error with route URL, method, and best-effort tenant ID
 *  - Returns structured JSON matching the errorResponse() contract
 *  - Status 500
 *
 * On happy paths: zero behavior change.
 *
 * Usage:
 *   export const GET = withApiHandler(async function GET(req) { ... });
 *   export const POST = withApiHandler(async function POST(req, ctx) { ... });
 */
export function withApiHandler<TArgs extends unknown[]>(
  handler: ApiHandler<TArgs>,
): ApiHandler<TArgs> {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      // ── Structured logging for multi-tenant debugging ──
      const maybeReq = args[0];
      const req = maybeReq instanceof Request ? maybeReq : undefined;
      const method = req?.method ?? "UNKNOWN";
      const url = req?.url ?? "unknown-url";
      const tenantHint = req ? await extractTenantHint(req) : "unknown";

      console.error(
        `[API Error] ${method} ${url} | tenant=${tenantHint} |`,
        err,
      );

      // ── Structured error response (matches errorResponse() contract) ──
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";

      const body: ApiErrorBody = {
        ok: false,
        code: "INTERNAL_ERROR",
        message,
        userAction: "retry_later",
      };

      return NextResponse.json(body, { status: 500 });
    }
  };
}
