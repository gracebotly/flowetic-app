

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const getClientContext = createTool({
  id: "getClientContext",
  description: "Fetch tenant context: connected sources and last event timestamp per source.",
  inputSchema: z.object({
    tenantId: z.string().uuid().optional(),
  }),
  outputSchema: z.object({
    tenantId: z.string().uuid(),
    sources: z.array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        status: z.string().nullable(),
        lastEventTime: z.string().nullable(),
      }),
    ),
  }),
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();

    const tenantId =
      context.tenantId ??
      (runtimeContext?.get("tenantId") as string | undefined) ??
      undefined;

    if (!tenantId) {
      throw new Error("AUTH_REQUIRED");
    }

    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("id,type,status")
      .eq("tenant_id", tenantId);

    if (sourcesError) throw new Error(sourcesError.message);

    const results: Array<{
      id: string;
      type: string;
      status: string | null;
      lastEventTime: string | null;
    }> = [];

    for (const s of sources ?? []) {
      const { data: lastEvent, error: lastEventError } = await supabase
        .from("events")
        .select("timestamp")
        .eq("tenant_id", tenantId)
        .eq("source_id", s.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEventError) throw new Error(lastEventError.message);

      results.push({
        id: s.id,
        type: s.type,
        status: s.status ?? null,
        lastEventTime: lastEvent?.timestamp ?? null,
      });
    }

    return { tenantId, sources: results };
  },
});



