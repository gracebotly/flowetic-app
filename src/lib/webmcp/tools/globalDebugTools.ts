/* eslint-disable no-console */

declare global {
  // eslint-disable-next-line no-var
  var __GF_CONSOLE_PATCHED__: boolean | undefined;

  // eslint-disable-next-line no-var
  var __GF_CONSOLE_BUFFER__:
    | Array<{ ts: string; level: "error" | "warn"; args: unknown[] }>
    | undefined;

  // eslint-disable-next-line no-var
  var __GF_FETCH_LOG__: Array<{
    ts: string;
    method: string;
    url: string;
    status: number;
    duration: number;
  }> | undefined;

  // eslint-disable-next-line no-var
  var __GF_FETCH_PATCHED__: boolean | undefined;
}

function toolText(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function patchFetchOnce() {
  if (globalThis.__GF_FETCH_PATCHED__) return;
  globalThis.__GF_FETCH_PATCHED__ = true;
  globalThis.__GF_FETCH_LOG__ = [];

  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const start = Date.now();
    const url = typeof args[0] === "string" 
      ? args[0] 
      : args[0] instanceof Request 
        ? args[0].url 
        : args[0]?.toString() || "";
    const method = args[1]?.method || "GET";
    
    try {
      const res = await origFetch(...args);
      const duration = Date.now() - start;
      
      globalThis.__GF_FETCH_LOG__!.push({
        ts: new Date().toISOString(),
        method,
        url,
        status: res.status,
        duration,
      });
      
      // Keep last 50
      if (globalThis.__GF_FETCH_LOG__!.length > 50) {
        globalThis.__GF_FETCH_LOG__ = globalThis.__GF_FETCH_LOG__!.slice(-50);
      }
      
      return res;
    } catch (err) {
      const duration = Date.now() - start;
      globalThis.__GF_FETCH_LOG__!.push({
        ts: new Date().toISOString(),
        method,
        url,
        status: 0,
        duration,
      });
      throw err;
    }
  };
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

export async function registerGlobalDebugTools() {
  if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;
  if (typeof window === "undefined") return;

  // A1) DIAGNOSTIC TOOLS (12 new)

  // 1) gf_feature_flags
  await registerToolOrThrow({
    name: "gf_feature_flags",
    description: "Returns all NEXT_PUBLIC_* environment flags (redacted if sensitive).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const flags: Record<string, string> = {};
      for (const key in process.env) {
        if (key.startsWith("NEXT_PUBLIC_")) {
          // Redact API keys/secrets
          flags[key] = key.includes("KEY") || key.includes("SECRET") 
            ? "***REDACTED***" 
            : String(process.env[key]);
        }
      }
      return toolText({ ok: true, flags });
    }
  });

  // 2) gf_page_identity
  await registerToolOrThrow({
    name: "gf_page_identity",
    description: "Returns current page pathname, route segment, and query params.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const url = new URL(window.location.href);
      return toolText({
        ok: true,
        pathname: url.pathname,
        search: url.search,
        searchParams: Object.fromEntries(url.searchParams),
        hash: url.hash,
      });
    }
  });

  // 3) gf_runtime_health
  await registerToolOrThrow({
    name: "gf_runtime_health",
    description: "Returns basic runtime health: memory usage, performance timing, connection status.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const perf = performance as any;
      const memory = (perf.memory) ? {
        usedJSHeapSize: perf.memory.usedJSHeapSize,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        limit: perf.memory.jsHeapSizeLimit,
      } : null;

      const timing = performance.timing ? {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      } : null;

      return toolText({
        ok: true,
        online: navigator.onLine,
        memory,
        timing,
      });
    }
  });

  // 4) gf_fetch_log_recent
  await registerToolOrThrow({
    name: "gf_fetch_log_recent",
    description: "Returns last ~50 fetch requests with URL, method, status, and duration.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      patchFetchOnce(); // Ensure patching
      return toolText({
        ok: true,
        count: globalThis.__GF_FETCH_LOG__?.length || 0,
        entries: globalThis.__GF_FETCH_LOG__ || [],
      });
    }
  });

  // 5) gf_dom_find
  await registerToolOrThrow({
    name: "gf_dom_find",
    description: "Finds elements by CSS selector and returns count + existence + text preview of first match.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector to find" },
      },
      required: ["selector"],
    },
    async execute(args: any) {
      const selector = String(args?.selector || "");
      if (!selector) {
        return toolText({ ok: false, message: "selector is required" });
      }

      try {
        const elements = document.querySelectorAll(selector);
        const first = elements[0];
        const preview = first
          ? {
              tag: first.tagName.toLowerCase(),
              text: first.textContent?.slice(0, 200) || "",
              classes: Array.from(first.classList),
              id: first.id || null,
            }
          : null;

        return toolText({
          ok: true,
          selector,
          exists: elements.length > 0,
          count: elements.length,
          first: preview,
        });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Invalid selector",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 6) gf_dom_active_element
  await registerToolOrThrow({
    name: "gf_dom_active_element",
    description: "Returns info about the currently focused element (document.activeElement).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const el = document.activeElement;
      if (!el || el === document.body) {
        return toolText({ ok: true, focused: false });
      }

      return toolText({
        ok: true,
        focused: true,
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: Array.from(el.classList),
        text: el.textContent?.slice(0, 100) || "",
      });
    }
  });

  // 7) gf_local_storage_dump
  await registerToolOrThrow({
    name: "gf_local_storage_dump",
    description: "Returns localStorage keys/values (optionally filtered by prefix). Values are truncated.",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string", description: "Optional prefix to filter keys (e.g., 'gf_')" },
      },
    },
    async execute(args: any) {
      const prefix = String(args?.prefix || "");
      const items: Record<string, string> = {};

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (!prefix || key.startsWith(prefix))) {
          const value = localStorage.getItem(key) || "";
          items[key] = value.slice(0, 200); // Truncate long values
        }
      }

      return toolText({
        ok: true,
        count: Object.keys(items).length,
        items,
      });
    }
  });

  // 8) gf_cookie_names
  await registerToolOrThrow({
    name: "gf_cookie_names",
    description: "Returns list of cookie names (no values for security).",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      const cookies = document.cookie.split(";").map(c => c.trim().split("=")[0]);
      return toolText({
        ok: true,
        count: cookies.length,
        names: cookies,
      });
    }
  });

  // A2) ACTION TOOLS (3 new) - Disabled by default for security

  // 9) gf_dom_click
  await registerToolOrThrow({
    name: "gf_dom_click",
    description: "Clicks the first element matching the selector. ACTION TOOL - use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of element to click" },
      },
      required: ["selector"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const selector = String(args?.selector || "");
      if (!selector) {
        return toolText({ ok: false, message: "selector is required" });
      }

      try {
        const el = document.querySelector(selector);
        if (!el) {
          return toolText({ ok: false, message: `Element not found: ${selector}` });
        }

        (el as HTMLElement).click();
        return toolText({ ok: true, message: `Clicked: ${selector}` });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Click failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 10) gf_dom_fill
  await registerToolOrThrow({
    name: "gf_dom_fill",
    description: "Fills an input/textarea with the given value. ACTION TOOL - use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of input/textarea" },
        value: { type: "string", description: "Value to set" },
      },
      required: ["selector", "value"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const selector = String(args?.selector || "");
      const value = String(args?.value || "");

      if (!selector) {
        return toolText({ ok: false, message: "selector is required" });
      }

      try {
        const el = document.querySelector(selector);
        if (!el) {
          return toolText({ ok: false, message: `Element not found: ${selector}` });
        }

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return toolText({ ok: true, message: `Filled: ${selector}` });
        } else {
          return toolText({ ok: false, message: "Element is not an input/textarea" });
        }
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Fill failed",
          error: String(err?.message || err),
        });
      }
    }
  });

  // 11) gf_dom_press_key
  await registerToolOrThrow({
    name: "gf_dom_press_key",
    description: "Simulates a keyboard key press on the active element. ACTION TOOL - use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key to press (e.g., 'Enter', 'Escape', 'Tab')" },
      },
      required: ["key"],
    },
    async execute(args: any) {
      if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP_ACTIONS !== "true") {
        return toolText({ ok: false, message: "ACTION tools are disabled" });
      }

      const key = String(args?.key || "");
      if (!key) {
        return toolText({ ok: false, message: "key is required" });
      }

      try {
        const el = document.activeElement;
        if (!el || el === document.body) {
          return toolText({ ok: false, message: "No active element to send key to" });
        }

        el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));

        return toolText({ ok: true, message: `Pressed key: ${key}` });
      } catch (err: any) {
        return toolText({
          ok: false,
          message: "Key press failed",
          error: String(err?.message || err),
        });
      }
    }
  });
}
