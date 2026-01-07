
/* eslint-disable no-console */

import { registerControlPanelDebugTools } from "@/lib/webmcp/tools/controlPanelDebugTools";
import { registerGlobalDebugTools } from "@/lib/webmcp/tools/globalDebugTools";
import { registerConnectionsDebugTools } from "@/lib/webmcp/tools/connectionsDebugTools";
import { registerChatDebugTools } from "@/lib/webmcp/tools/chatDebugTools";

declare global {
  // eslint-disable-next-line no-var
  var __GF_WEBMCP_INIT__: boolean | undefined;

  // eslint-disable-next-line no-var
  var __GF_CONSOLE_BUFFER__:
    | Array<{ ts: string; level: "error" | "warn"; args: unknown[] }>
    | undefined;
}

async function waitForModelContextReady() {
  const mc = (navigator as any)?.modelContext;
  if (!mc || typeof mc.registerTool !== "function") {
    throw new Error("WebMCP modelContext not available after import");
  }
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

    const pathname = window.location.pathname;

    // ALWAYS register: existing 4 control panel tools (global)
    await registerControlPanelDebugTools();

    // ALWAYS register: new 15 global tools
    await registerGlobalDebugTools();

    // ROUTE-SCOPED: Connections tools (only on /control-panel/connections)
    if (pathname.startsWith("/control-panel/connections")) {
      await registerConnectionsDebugTools();
      console.log("[webmcp] ✅ Connections tools registered");
    }

    // ROUTE-SCOPED: Chat tools (only on /control-panel/chat)
    if (pathname.startsWith("/control-panel/chat")) {
      await registerChatDebugTools();
      console.log("[webmcp] ✅ Chat tools registered");
    }

    console.log("[webmcp] ✅ All tools registered successfully");
  } catch (err) {
    globalThis.__GF_WEBMCP_INIT__ = false;
    console.error("[webmcp] init failed", err);
  }
}

