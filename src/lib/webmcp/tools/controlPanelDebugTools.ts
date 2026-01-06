/* eslint-disable no-console */

declare global {
  // eslint-disable-next-line no-var
  var __GF_CONSOLE_PATCHED__: boolean | undefined;

  // eslint-disable-next-line no-var
  var __GF_CONSOLE_BUFFER__:
    | Array<{ ts: string; level: "error" | "warn"; args: unknown[] }>
    | undefined;
}

function toolText(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function ensureConsoleBuffer() {
  if (!globalThis.__GF_CONSOLE_BUFFER__) globalThis.__GF_CONSOLE_BUFFER__ = [];
}

function safePush(level: "error" | "warn", args: unknown[]) {
  ensureConsoleBuffer();
  globalThis.__GF_CONSOLE_BUFFER__!.push({
    ts: new Date().toISOString(),
    level,
    args,
  });
  // Keep last 50
  if (globalThis.__GF_CONSOLE_BUFFER__!.length > 50) {
    globalThis.__GF_CONSOLE_BUFFER__ = globalThis.__GF_CONSOLE_BUFFER__!.slice(-50);
  }
}

function patchConsoleOnce() {
  if (globalThis.__GF_CONSOLE_PATCHED__) return;
  globalThis.__GF_CONSOLE_PATCHED__ = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    try {
      safePush("error", args);
    } catch {
      // ignore
    }
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    try {
      safePush("warn", args);
    } catch {
      // ignore
    }
    origWarn(...args);
  };
}

function registerToolOrThrow(tool: {
  name: string;
  description?: string;
  inputSchema?: any;
  execute: (args: any) => Promise<any> | any;
}) {
  const mc = (navigator as any)?.modelContext;
  const registerTool = mc?.registerTool as ((tool: any) => void) | undefined;
  if (!registerTool) {
    throw new Error("navigator.modelContext.registerTool is not available (WebMCP polyfill not loaded?)");
  }
  registerTool(tool);
}

const SAFE_PROBE_PATHS = new Set<string>([
  "/api/credentials/list",
  "/api/indexed-entities/list",
]);

export function registerControlPanelDebugTools() {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  patchConsoleOnce();

  // 1) ping
  registerToolOrThrow({
    name: "gf_debug_ping",
    description: "Sanity check: returns ok + timestamp + current URL.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      return toolText({
        ok: true,
        ts: new Date().toISOString(),
        href: window.location.href,
        pathname: window.location.pathname,
      });
    },
  });

  // 2) env
  registerToolOrThrow({
    name: "gf_debug_env",
    description: "Returns whether WebMCP is enabled and basic runtime environment flags.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      return toolText({
        enableWebmcpFlag: process.env.NEXT_PUBLIC_ENABLE_WEBMCP === "true",
        nodeEnv: process.env.NODE_ENV,
      });
    },
  });

  // 3) console buffer
  registerToolOrThrow({
    name: "gf_recent_console_errors",
    description: "Returns recent console.error / console.warn entries captured since page load (last 50).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      ensureConsoleBuffer();
      return toolText({
        ok: true,
        count: globalThis.__GF_CONSOLE_BUFFER__!.length,
        entries: globalThis.__GF_CONSOLE_BUFFER__,
      });
    },
  });

  // 4) safe GET probe
  registerToolOrThrow({
    name: "gf_network_probe",
    description:
      "Fetches a whitelisted GET endpoint and returns status + small summary. Allowed paths: /api/credentials/list, /api/indexed-entities/list",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Request path to probe (must be whitelisted)" },
      },
      required: ["path"],
    },
    async execute(args: any) {
      const path = String(args?.path ?? "");
      if (!SAFE_PROBE_PATHS.has(path)) {
        return toolText({
          ok: false,
          message: `Path not allowed: ${path}`,
          allowed: Array.from(SAFE_PROBE_PATHS),
        });
      }

      try {
        const res = await fetch(path, { method: "GET" });
        const text = await res.text().catch(() => "");
        let json: any = null;
        let jsonOk = false;
        try {
          json = JSON.parse(text);
          jsonOk = true;
        } catch {
          // ignore
        }

        const bodyPreview = text.slice(0, 500);

        const count =
          jsonOk && json && typeof json === "object"
            ? (Array.isArray(json.credentials) ? json.credentials.length : Array.isArray(json.entities) ? json.entities.length : undefined)
            : undefined;

        return toolText({
          ok: true,
          status: res.status,
          okHttp: res.ok,
          jsonOk,
          count,
          bodyPreview,
        });
      } catch (e: any) {
        return toolText({
          ok: false,
          message: "Fetch failed",
          error: String(e?.message ?? e),
        });
      }
    },
  });
}
