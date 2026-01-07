
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
  const registerTool = mc?.registerTool as ((tool: any) => void) | undefined;
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
}

