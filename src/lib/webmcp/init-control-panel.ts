
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

export async function initControlPanelWebMcp(): Promise<void> {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  if (globalThis.__GF_WEBMCP_INIT__) return;

  // Mark early to avoid double-init in React strict mode or remounts
  globalThis.__GF_WEBMCP_INIT__ = true;

  try {
    // WebMCP polyfill
    await import("@mcp-b/global");

    registerControlPanelDebugTools();
    registerConnectionsDebugTools();
  } catch (err) {
    // If something fails, allow re-init on refresh
    globalThis.__GF_WEBMCP_INIT__ = false;
    console.error("[webmcp] init failed", err);
  }
}

