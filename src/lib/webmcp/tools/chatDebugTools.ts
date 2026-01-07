
/* eslint-disable no-console */

declare global {
  interface Window {
    __GF_CHAT_WORKSPACE_STATE__?: any;
    __GF_VIBE_CONTEXT__?: any;
    __GF_CHAT_MESSAGES__?: any[];
  }
}

function toolText(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

async function registerToolOrThrow(tool: {
  name: string;
  description?: string;
  inputSchema?: any;
  execute: (args: any) => Promise<any> | any;
}) {
  const mc = (navigator as any)?.modelContext;
  const registerTool = mc?.registerTool?.bind(mc) as ((tool: any) => void) | undefined;
  if (!registerTool) {
    throw new Error("navigator.modelContext.registerTool is not available");
  }

  // Per MCP-B docs, registerTool is synchronous
  // Call it directly without retry logic
  registerTool(tool);
}

export async function registerChatDebugTools() {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  // C1) DIAGNOSTIC TOOLS (9 new)

  // 1) gf_chat_ping
  await registerToolOrThrow({
    name: "gf_chat_ping",
    description: "Chat page sanity check: returns ok + timestamp + pathname.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      return toolText({
        ok: true,
        ts: new Date().toISOString(),
        pathname: window.location.pathname,
        isChat: window.location.pathname.includes("/chat"),
      });
    }
  });

  // 2) gf_chat_workspace_snapshot
  await registerToolOrThrow({
    name: "gf_chat_workspace_snapshot",
    description: "Returns current chat workspace state from window.__GF_CHAT_WORKSPACE_STATE__ if available.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const state = window.__GF_CHAT_WORKSPACE_STATE__;
      if (!state) {
        return toolText({
          ok: false,
          message: "No chat workspace state found. Are you on /control-panel/chat?",
        });
      }

      return toolText({
        ok: true,
        view: state.view || "unknown",
        chatMode: state.chatMode || "unknown",
        isLoading: state.isLoading || false,
        isListening: state.isListening || false,
        previewDashboardId: state.previewDashboardId || null,
        previewVersionId: state.previewVersionId || null,
      });
    }
  });

  // 3) gf_vibe_context_snapshot
  await registerToolOrThrow({
    name: "gf_vibe_context_snapshot",
    description: "Returns vibe context data (from /api/vibe/context) if available in window.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const context = window.__GF_VIBE_CONTEXT__;
      if (!context) {
        return toolText({
          ok: false,
          message: "No vibe context found. Has /api/vibe/context been fetched?",
        });
      }

      return toolText({
        ok: true,
        context,
      });
    }
  });

  // 4) gf_vibe_handoff_readiness
  await registerToolOrThrow({
    name: "gf_vibe_handoff_readiness",
    description: "Checks if chat handoff is ready: auth, credentials, indexed entities, vibe context.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const issues: string[] = [];

      // Check auth (basic check)
      const hasAuth = document.cookie.includes("sb-");
      if (!hasAuth) issues.push("No Supabase session cookie found");

      // Check credentials
      try {
        const credRes = await fetch("/api/credentials/list", { method: "GET" });
        const credJson = await credRes.json().catch(() => ({}));
        const credCount = credJson?.credentials?.length || 0;
        if (credCount === 0) issues.push("No credentials configured");
      } catch {
        issues.push("Failed to fetch credentials");
      }

      // Check indexed entities
      try {
        const entRes = await fetch("/api/indexed-entities/list", { method: "GET" });
        const entJson = await entRes.json().catch(() => ({}));
        const entCount = entJson?.entities?.length || 0;
        if (entCount === 0) issues.push("No entities indexed");
      } catch {
        issues.push("Failed to fetch indexed entities");
      }

      // Check vibe context
      const vibeContext = window.__GF_VIBE_CONTEXT__;
      if (!vibeContext) issues.push("Vibe context not loaded");

      const ready = issues.length === 0;

      return toolText({
        ok: true,
        ready,
        issues: ready ? [] : issues,
      });
    }
  });

  // 5) gf_connections_indexed_entities_for_vibe
  await registerToolOrThrow({
    name: "gf_connections_indexed_entities_for_vibe",
    description: "Fetches indexed entities and summarizes by platform/kind for vibe context.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      try {
        const res = await fetch("/api/indexed-entities/list", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const entities = json?.entities || [];

        const byPlatform: Record<string, number> = {};
        const byKind: Record<string, number> = {};

        for (const e of entities) {
          const platform = e?.platform || "unknown";
          const kind = e?.kind || "unknown";
          byPlatform[platform] = (byPlatform[platform] || 0) + 1;
          byKind[kind] = (byKind[kind] || 0) + 1;
        }

        return toolText({
          ok: true,
          total: entities.length,
          byPlatform,
          byKind,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Fetch failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 6) gf_connections_credentials_for_vibe
  await registerToolOrThrow({
    name: "gf_connections_credentials_for_vibe",
    description: "Fetches credentials and summarizes by platformType for vibe context.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      try {
        const res = await fetch("/api/credentials/list", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const credentials = json?.credentials || [];

        const byPlatform: Record<string, number> = {};

        for (const c of credentials) {
          const platform = c?.platformType || "unknown";
          byPlatform[platform] = (byPlatform[platform] || 0) + 1;
        }

        return toolText({
          ok: true,
          total: credentials.length,
          byPlatform,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Fetch failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 7) gf_chat_messages_summary
  await registerToolOrThrow({
    name: "gf_chat_messages_summary",
    description: "Returns count and last message role from chat history if available.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const messages = window.__GF_CHAT_MESSAGES__;
      if (!messages || !Array.isArray(messages)) {
        return toolText({
          ok: false,
          message: "No chat messages found in window.__GF_CHAT_MESSAGES__",
        });
      }

      const last = messages[messages.length - 1];

      return toolText({
        ok: true,
        count: messages.length,
        lastRole: last?.role || null,
        lastPreview: last?.content?.slice(0, 100) || null,
      });
    }
  });

  // 8) gf_chat_messages_history_redacted
  await registerToolOrThrow({
    name: "gf_chat_messages_history_redacted",
    description: "Returns last N chat messages (truncated and redacted). Default N=10.",
    inputSchema: {
      type: "object",
      properties: {
        n: { type: "number", description: "Number of recent messages to return (default 10)" },
      },
    },
    async execute(args: any) {
      const n = Number(args?.n || 10);
      const messages = window.__GF_CHAT_MESSAGES__;
      
      if (!messages || !Array.isArray(messages)) {
        return toolText({
          ok: false,
          message: "No chat messages found",
        });
      }

      const recent = messages.slice(-n).map((m: any) => ({
        role: m?.role || "unknown",
        content: String(m?.content || "").slice(0, 200), // Truncate
        timestamp: m?.timestamp || null,
      }));

      return toolText({
        ok: true,
        count: recent.length,
        messages: recent,
      });
    }
  });

  // 9) gf_preview_identity
  await registerToolOrThrow({
    name: "gf_preview_identity",
    description: "Returns preview dashboard ID and version ID if set, plus inferred preview URL.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const state = window.__GF_CHAT_WORKSPACE_STATE__;
      const dashboardId = state?.previewDashboardId || null;
      const versionId = state?.previewVersionId || null;

      const previewUrl = dashboardId && versionId
        ? `/preview/${dashboardId}/${versionId}`
        : null;

      return toolText({
        ok: true,
        previewDashboardId: dashboardId,
        previewVersionId: versionId,
        previewUrl,
      });
    }
  });

  // C2) ACTION TOOLS (3 new) - Disabled by default for security

  // 10) gf_vibe_set_view_mode
  await registerToolOrThrow({
    name: "gf_vibe_set_view_mode",
    description: "Sets chat view mode (terminal|preview|publish). ACTION TOOL.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["terminal", "preview", "publish"],
          description: "View mode to set",
        },
      },
      required: ["mode"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const mode = String(args?.mode || "");
      if (!["terminal", "preview", "publish"].includes(mode)) {
        return toolText({
          ok: false,
          message: "mode must be 'terminal', 'preview', or 'publish'",
        });
      }

      try {
        // Look for view mode buttons (adjust selectors as needed)
        const buttons = Array.from(document.querySelectorAll("button"));
        const targetBtn = buttons.find(b =>
          b.textContent?.toLowerCase().includes(mode) ||
          b.getAttribute("data-view")?.toLowerCase() === mode
        );

        if (!targetBtn) {
          return toolText({ ok: false, message: `View mode button '${mode}' not found` });
        }

        (targetBtn as HTMLElement).click();
        return toolText({ ok: true, message: `View mode set to: ${mode}` });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Set view mode failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 11) gf_vibe_refresh_context
  await registerToolOrThrow({
    name: "gf_vibe_refresh_context",
    description: "Re-fetches /api/vibe/context and updates window.__GF_VIBE_CONTEXT__. ACTION TOOL.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      try {
        const res = await fetch("/api/vibe/context", { method: "GET" });
        if (!res.ok) {
          return toolText({
            ok: false,
            message: "Failed to fetch vibe context",
            status: res.status,
          });
        }

        const json = await res.json();
        window.__GF_VIBE_CONTEXT__ = json;

        return toolText({
          ok: true,
          message: "Vibe context refreshed",
          context: json,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Refresh failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 12) gf_vibe_open_preview
  await registerToolOrThrow({
    name: "gf_vibe_open_preview",
    description: "Navigates to preview URL. Optionally accepts dashboardId/versionId. ACTION TOOL.",
    inputSchema: {
      type: "object",
      properties: {
        dashboardId: { type: "string", description: "Optional dashboard ID" },
        versionId: { type: "string", description: "Optional version ID" },
      },
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      let dashboardId = String(args?.dashboardId || "");
      let versionId = String(args?.versionId || "");

      // If not provided, try to get from workspace state
      if (!dashboardId || !versionId) {
        const state = window.__GF_CHAT_WORKSPACE_STATE__;
        dashboardId = dashboardId || state?.previewDashboardId || "";
        versionId = versionId || state?.previewVersionId || "";
      }

      if (!dashboardId || !versionId) {
        return toolText({
          ok: false,
          message: "dashboardId and versionId are required (or must be in workspace state)",
        });
      }

      const url = `/preview/${dashboardId}/${versionId}`;

      try {
        window.location.href = url;
        return toolText({
          ok: true,
          message: `Navigating to preview: ${url}`,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Navigation failed",
          error: String(err?.message || err),
        });
      }
    }
  });

}
