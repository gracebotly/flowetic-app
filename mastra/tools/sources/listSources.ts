
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SourcePublic, SourcePlatformType, SourceMethod, SourceStatus } from "./types";

export const listSources = createTool({
  id: "sources.list",
  description: "List all sources (platform connections) for the given tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
  }),
  outputSchema: z.object({
    sources: z.array(SourcePublic),
  }),
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {
    const supabase = await createClient();
    const { tenantId } = inputData;

    const { data, error } = await supabase
      .from("sources")
      .select("id, tenant_id, type, name, method, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`SOURCES_LIST_FAILED: ${error.message}`);

    const rows = (data ?? []).map((s: any) => ({
      id: String(s.id),
      tenantId: String(s.tenant_id),
      type: SourcePlatformType.parse(String(s.type ?? "other")),
      name: String(s.name ?? s.type ?? "connection"),
      method: SourceMethod.parse(String(s.method ?? "api")),
      status: SourceStatus.parse(String(s.status ?? "active")),
      createdAt: String(s.created_at),
    }));

    return { sources: rows };
  },
});
