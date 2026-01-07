
/* eslint-disable no-console */

declare global {
  interface Window {
    __GF_CONNECTIONS_DEBUG_STATE__?: any;
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

function textExists(t: string) {
  const bodyText = document?.body?.innerText ?? "";
  return bodyText.includes(t);
}

export async function registerConnectionsDebugTools() {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  // Snapshot (from window global written by the page)
  await registerToolOrThrow({
    name: "gf_connections_snapshot",
    description: "Returns the current Connections page debug state snapshot (from window.__GF_CONNECTIONS_DEBUG_STATE__).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const state = window.__GF_CONNECTIONS_DEBUG_STATE__;
      if (!state) {
        return toolText({ ok: false, message: "No debug state found. Are you on /control-panel/connections?" });
      }
      return toolText({ ok: true, state });
    },
  });

  // DOM summary
  await registerToolOrThrow({
    name: "gf_connections_dom_summary",
    description: "Returns a small DOM-based summary for Connections page (counts, empty states, modal presence).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const credentialActionButtons = document.querySelectorAll('button[aria-label="Credential actions"]').length;
      const anyActionButtons = Array.from(document.querySelectorAll("button")).filter((b) =>
        (b.getAttribute("aria-label") || "").toLowerCase().includes("actions"),
      ).length;

      const emptyStateVisible = textExists("No credentials found.");
      // Generic detection of the modal overlay used in this repo
      const connectModalVisible = document.querySelectorAll("div.fixed.inset-0").length > 0;

      // If your entities step has stable text, detect it here. We'll use a conservative approach:
      const entitiesStepVisible = textExists("Select") && textExists("index");

      return toolText({
        ok: true,
        pathname: window.location.pathname,
        credentialActionButtons,
        anyActionButtons,
        emptyStateVisible,
        connectModalVisible,
        entitiesStepVisible,
      });
    },
  });

  // Fetch credentials list
  await registerToolOrThrow({
    name: "gf_connections_fetch_credentials",
    description: "Fetches GET /api/credentials/list and returns status + count + first item metadata (no secrets).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      try {
        const res = await fetch("/api/credentials/list", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const creds = (json?.credentials ?? []) as any[];
        const first = creds[0]
          ? {
              id: String(creds[0].id ?? ""),
              platformType: String(creds[0].platformType ?? ""),
              method: String(creds[0].method ?? ""),
              status: creds[0].status ?? null,
            }
          : null;

        return toolText({
          ok: true,
          status: res.status,
          okHttp: res.ok,
          okJson: Boolean(json?.ok),
          count: Array.isArray(creds) ? creds.length : 0,
          first,
        });
      } catch (e: any) {
        return toolText({ ok: false, message: "Fetch failed", error: String(e?.message ?? e) });
      }
    },
  });

  // Fetch indexed entities
  await registerToolOrThrow({
    name: "gf_connections_fetch_indexed_entities",
    description: "Fetches GET /api/indexed-entities/list and returns status + count + first item metadata.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      try {
        const res = await fetch("/api/indexed-entities/list", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const entities = (json?.entities ?? []) as any[];
        const first = entities[0]
          ? {
              id: String(entities[0].id ?? ""),
              platform: String(entities[0].platform ?? ""),
              kind: String(entities[0].kind ?? ""),
              name: String(entities[0].name ?? ""),
              sourceId: String(entities[0].sourceId ?? ""),
            }
          : null;

        return toolText({
          ok: true,
          status: res.status,
          okHttp: res.ok,
          okJson: Boolean(json?.ok),
          count: Array.isArray(entities) ? entities.length : 0,
          first,
        });
      } catch (e: any) {
        return toolText({ ok: false, message: "Fetch failed", error: String(e?.message ?? e) });
      }
    },
  });

  // Fetch n8n inventory
  await registerToolOrThrow({
    name: "gf_connections_fetch_inventory_n8n",
    description:
      "Fetches GET /api/connections/inventory/n8n/list?sourceId=... and returns totals. Input requires sourceId.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "The credential/source id to query inventory for" },
      },
      required: ["sourceId"],
    },
    async execute(args: any) {
      const sourceId = String(args?.sourceId ?? "");
      if (!sourceId) {
        return toolText({ ok: false, message: "sourceId is required" });
      }

      try {
        const url = `/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`;
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const rows = (json?.entities ?? []) as any[];

        const indexedCount = Array.isArray(rows)
          ? rows.filter((r) => Boolean(r?.enabledForAnalytics)).length
          : 0;

        return toolText({
          ok: true,
          status: res.status,
          okHttp: res.ok,
          okJson: Boolean(json?.ok),
          total: Array.isArray(rows) ? rows.length : 0,
          indexedCount,
        });
      } catch (e: any) {
        return toolText({ ok: false, message: "Fetch failed", error: String(e?.message ?? e) });
      }
    },
  });

  // ===== NEW TOOLS ADDED =====

  // B1) DIAGNOSTIC TOOLS (5 new)

  // 6) gf_connections_refresh_all
  await registerToolOrThrow({
    name: "gf_connections_refresh_all",
    description: "Triggers a full refresh of credentials and indexed entities data.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      try {
        const [credRes, entRes] = await Promise.all([
          fetch("/api/credentials/list", { method: "GET" }),
          fetch("/api/indexed-entities/list", { method: "GET" }),
        ]);

        return toolText({
          ok: true,
          credentials: { status: credRes.status, ok: credRes.ok },
          entities: { status: entRes.status, ok: entRes.ok },
          message: "Data refreshed",
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

  // 7) gf_connections_step_trace
  await registerToolOrThrow({
    name: "gf_connections_step_trace",
    description: "Returns the current connection flow step and state (from window.__GF_CONNECTIONS_DEBUG_STATE__).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const state = window.__GF_CONNECTIONS_DEBUG_STATE__;
      if (!state) {
        return toolText({ ok: false, message: "No debug state. Are you on /control-panel/connections?" });
      }

      return toolText({
        ok: true,
        currentStep: state.step || "unknown",
        platformType: state.platformType || null,
        method: state.method || null,
        sourceId: state.sourceId || null,
      });
    }
  });

  // 8) gf_connections_menu_state
  await registerToolOrThrow({
    name: "gf_connections_menu_state",
    description: "Detects if any action menus (kebab menus) are currently open on the page.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      // Look for common dropdown/menu indicators
      const openMenus = document.querySelectorAll('[role="menu"]:not([hidden])').length;
      const openDropdowns = document.querySelectorAll('[aria-expanded="true"]').length;

      return toolText({
        ok: true,
        openMenus,
        openDropdowns,
        anyOpen: openMenus > 0 || openDropdowns > 0,
      });
    }
  });

  // 9) gf_connections_fetch_inventory
  await registerToolOrThrow({
    name: "gf_connections_fetch_inventory",
    description: "Generic inventory fetcher. Currently only n8n is implemented. Other platforms return NOT_IMPLEMENTED.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform type (n8n, vapi, retell, etc.)" },
        sourceId: { type: "string", description: "Credential/source ID" },
      },
      required: ["platform", "sourceId"],
    },
    async execute(args: any) {
      const platform = String(args?.platform || "").toLowerCase();
      const sourceId = String(args?.sourceId || "");

      if (!sourceId) {
        return toolText({ ok: false, message: "sourceId is required" });
      }

      // Only n8n implemented for now
      if (platform !== "n8n") {
        return toolText({
          ok: false,
          message: `Platform '${platform}' not yet implemented. Only 'n8n' is supported.`,
          platform,
        });
      }

      try {
        const url = `/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`;
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const rows = json?.entities || [];

        return toolText({
          ok: true,
          platform,
          sourceId,
          total: rows.length,
          indexed: rows.filter((r: any) => r?.enabledForAnalytics).length,
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

  // 10) gf_connections_inventory_diff
  await registerToolOrThrow({
    name: "gf_connections_inventory_diff",
    description: "Shows indexed vs unindexed entities for a given platform + sourceId (n8n only for now).",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform type (n8n only for now)" },
        sourceId: { type: "string", description: "Credential/source ID" },
      },
      required: ["platform", "sourceId"],
    },
    async execute(args: any) {
      const platform = String(args?.platform || "").toLowerCase();
      const sourceId = String(args?.sourceId || "");

      if (!sourceId) {
        return toolText({ ok: false, message: "sourceId is required" });
      }

      if (platform !== "n8n") {
        return toolText({
          ok: false,
          message: `Platform '${platform}' not yet implemented. Only 'n8n' is supported.`,
        });
      }

      try {
        const url = `/api/connections/inventory/n8n/list?sourceId=${encodeURIComponent(sourceId)}`;
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const rows = json?.entities || [];

        const indexed = rows.filter((r: any) => r?.enabledForAnalytics);
        const unindexed = rows.filter((r: any) => !r?.enabledForAnalytics);

        return toolText({
          ok: true,
          platform,
          sourceId,
          total: rows.length,
          indexed: indexed.map((r: any) => ({
            externalId: r.externalId,
            name: r.name,
          })),
          unindexed: unindexed.map((r: any) => ({
            externalId: r.externalId,
            name: r.name,
          })),
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

  // B2) ACTION TOOLS (5 new) - Disabled by default for security

  // 11) gf_connections_set_filter
  await registerToolOrThrow({
    name: "gf_connections_set_filter",
    description: "Sets the connections page filter to 'all' or 'credentials'. ACTION TOOL.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "credentials"], description: "Filter value" },
      },
      required: ["filter"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const filter = String(args?.filter || "");
      if (!["all", "credentials"].includes(filter)) {
        return toolText({ ok: false, message: "filter must be 'all' or 'credentials'" });
      }

      try {
        // Look for filter buttons (adjust selector as needed)
        const buttons = Array.from(document.querySelectorAll("button"));
        const targetButton = buttons.find(b => 
          b.textContent?.toLowerCase().includes(filter)
        );

        if (!targetButton) {
          return toolText({ ok: false, message: `Filter button '${filter}' not found` });
        }

        (targetButton as HTMLElement).click();
        return toolText({ ok: true, message: `Filter set to: ${filter}` });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Set filter failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 12) gf_connections_open_connect_modal
  await registerToolOrThrow({
    name: "gf_connections_open_connect_modal",
    description: "Clicks the 'Connect Platform' button to open the connection modal. ACTION TOOL.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      try {
        // Look for "Connect" button (adjust selector as needed)
        const buttons = Array.from(document.querySelectorAll("button"));
        const connectBtn = buttons.find(b => 
          b.textContent?.toLowerCase().includes("connect platform") ||
          b.textContent?.toLowerCase().includes("connect")
        );

        if (!connectBtn) {
          return toolText({ ok: false, message: "Connect button not found" });
        }

        (connectBtn as HTMLElement).click();
        return toolText({ ok: true, message: "Connect modal opened" });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Open modal failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 13) gf_connections_inventory_import
  await registerToolOrThrow({
    name: "gf_connections_inventory_import",
    description: "Imports/indexes entities for a platform (n8n only for now). ACTION TOOL.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "Platform type (n8n only)" },
        sourceId: { type: "string", description: "Credential/source ID" },
      },
      required: ["platform", "sourceId"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const platform = String(args?.platform || "").toLowerCase();
      const sourceId = String(args?.sourceId || "");

      if (!sourceId) {
        return toolText({ ok: false, message: "sourceId is required" });
      }

      if (platform !== "n8n") {
        return toolText({
          ok: false,
          message: `Platform '${platform}' not yet implemented. Only 'n8n' is supported.`,
        });
      }

      try {
        // This would typically POST to an import endpoint
        // Adjust based on your actual API
        const url = `/api/connections/inventory/n8n/import`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId }),
        });

        if (!res.ok) {
          return toolText({
            ok: false,
            message: "Import failed",
            status: res.status,
          });
        }

        const json = await res.json().catch(() => ({}));
        return toolText({
          ok: true,
          message: "Import initiated",
          result: json,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Import failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 14) gf_connections_select_entities
  await registerToolOrThrow({
    name: "gf_connections_select_entities",
    description: "Selects/indexes specific entities by their externalIds. ACTION TOOL.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "Credential/source ID" },
        externalIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of external IDs to select/index",
        },
      },
      required: ["sourceId", "externalIds"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const sourceId = String(args?.sourceId || "");
      const externalIds = args?.externalIds || [];

      if (!sourceId) {
        return toolText({ ok: false, message: "sourceId is required" });
      }

      if (!Array.isArray(externalIds) || externalIds.length === 0) {
        return toolText({ ok: false, message: "externalIds array is required" });
      }

      try {
        // Adjust endpoint as needed
        const url = `/api/indexed-entities/select`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId, externalIds }),
        });

        if (!res.ok) {
          return toolText({
            ok: false,
            message: "Select failed",
            status: res.status,
          });
        }

        const json = await res.json().catch(() => ({}));
        return toolText({
          ok: true,
          message: `Selected ${externalIds.length} entities`,
          result: json,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Select failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 15) gf_connections_unindex_entity
  await registerToolOrThrow({
    name: "gf_connections_unindex_entity",
    description: "Unindexes/deselects a single entity by externalId. ACTION TOOL.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "Credential/source ID" },
        externalId: { type: "string", description: "External ID to unindex" },
      },
      required: ["sourceId", "externalId"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const sourceId = String(args?.sourceId || "");
      const externalId = String(args?.externalId || "");

      if (!sourceId || !externalId) {
        return toolText({ ok: false, message: "sourceId and externalId are required" });
      }

      try {
        // Adjust endpoint as needed
        const url = `/api/indexed-entities/unindex`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId, externalId }),
        });

        if (!res.ok) {
          return toolText({
            ok: false,
            message: "Unindex failed",
            status: res.status,
          });
        }

        const json = await res.json().catch(() => ({}));
        return toolText({
          ok: true,
          message: `Unindexed entity: ${externalId}`,
          result: json,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Unindex failed",
          error: String(err?.message || err),
        });
      }
    }
  });

}

