
/* eslint-disable no-console */

import { registerControlPanelDebugTools } from "@/lib/webmcp/tools/controlPanelDebugTools";
import { registerConnectionsDebugTools } from "@/lib/webmcp/tools/connectionsDebugTools";

declare global {
  // eslint-disable-next-line no-var
  var __GF_WEBMCP_INIT__:
    | boolean
    | undefined;

  // eslint-disable-next-line no-var
  var __GF_CONSOLE_BUFFER__:
    | Array<{ ts: string; level: "error" | "warn"; args: unknown[] }>
    | undefined;
}

async function waitForModelContextReady(opts?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 5000;
  const intervalMs = opts?.intervalMs ?? 50;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const mc = (navigator as any)?.modelContext;
    // readiness heuristic: object exists AND has registerTool function
    if (mc && typeof mc.registerTool === "function") return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("WebMCP modelContext not ready after timeout");
}

export async function initControlPanelWebMcp(): Promise<void> {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  if (globalThis.__GF_WEBMCP_INIT__) return;

  // Mark early to avoid double-init in React strict mode or remounts
  globalThis.__GF_WEBMCP_INIT__ = true;

  try {
    // WebMCP polyfill
    await import("@mcp-b/global");

    // Wait for modelContext to be ready before registering tools
    await waitForModelContextReady();

    await registerControlPanelDebugTools();
    await registerConnectionsDebugTools();
  } catch (err) {
    // If something fails, allow re-init on refresh
    globalThis.__GF_WEBMCP_INIT__ = false;
    console.error("[webmcp] init failed", err);
  }
}

