
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

async function waitForModelContextReady() {
  // Per MCP-B docs, modelContext should be available immediately after import
  // Just verify it exists, don't poll
  const mc = (navigator as any)?.modelContext;
  if (!mc || typeof mc.registerTool !== "function") {
    throw new Error("WebMCP modelContext not available after import");
  }
  // Give polyfill one tick to finish internal setup
  await new Promise((r) => setTimeout(r, 50));
}

export async function initControlPanelWebMcp(): Promise<void> {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  if (globalThis.__GF_WEBMCP_INIT__) return;
  globalThis.__GF_WEBMCP_INIT__ = true;

  try {
    await import("@mcp-b/global");
    await waitForModelContextReady();
    
    // CRITICAL FIX: Wait 500ms for polyfill internal state to fully initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await registerControlPanelDebugTools();
    await registerConnectionsDebugTools();

    console.log("[webmcp] ✅ All tools registered successfully");
  } catch (err) {
    globalThis.__GF_WEBMCP_INIT__ = false;
    console.error("[webmcp] init failed", err);
  }
}

