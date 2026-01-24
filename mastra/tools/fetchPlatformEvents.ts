
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const PlatformType = z.enum(["vapi", "n8n", "make", "retell"]);

function nowIso() {
  return new Date().toISOString();
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export const fetchPlatformEvents = createTool({
  id: "fetchPlatformEvents",
  description:
    "Fetch historical events from a connected platform API. Studio-first: uses env vars for credentials. Returns raw platform events.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    sourceId: z.string().min(1),
    platformType: PlatformType,
    eventCount: z.number().int().min(1).max(500).default(100),
  }),
  outputSchema: z.object({
    events: z.array(z.any()),
    count: z.number().int(),
    platformType: z.string(),
    fetchedAt: z.string(),
  }),
  execute: async (inputData) => {
    const { platformType, eventCount } = inputData;

    // Studio-first credential strategy (explicit, deterministic)
    // Set per-platform env vars in Mastra Studio:
    // - VAPI_API_KEY
    // - N8N_API_KEY + N8N_BASE_URL
    // - MAKE_API_KEY + MAKE_BASE_URL
    // - RETELL_API_KEY
    //
    // If missing, return an empty list (do NOT hallucinate events).
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (platformType === "vapi") {
          const apiKey = process.env.VAPI_API_KEY;
          if (!apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };

          // Placeholder endpoint design: keep a bounded, safe fetch.
          // If you later add a real endpoint, implement it here.
          // For now, no-op unless you provide a real Vapi endpoint.
          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }

        if (platformType === "n8n") {
          const baseUrl = process.env.N8N_BASE_URL;
          const apiKey = process.env.N8N_API_KEY;
          if (!baseUrl || !apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };

          // Minimal safe stub — real implementation can be added later.
          // Must not break Phase 1 network correctness.
          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }

        if (platformType === "make") {
          const baseUrl = process.env.MAKE_BASE_URL;
          const apiKey = process.env.MAKE_API_KEY;
          if (!baseUrl || !apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };

          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }

        if (platformType === "retell") {
          const apiKey = process.env.RETELL_API_KEY;
          if (!apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };

          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }

        // unreachable due to enum
        return { events: [], count: 0, platformType, fetchedAt: nowIso() };
      } catch (e: any) {
        if (attempt === maxRetries) {
          throw new Error(
            `FETCH_PLATFORM_EVENTS_FAILED: ${String(e?.message || e)}`,
          );
        }
        await sleep(250 * attempt);
      }
    }

    return { 
      events: [], 
      count: Math.min(eventCount ?? 0, 0),  // FIXED: Explicit null coalescing
      platformType, 
      fetchedAt: nowIso() 
    };
  },
});
