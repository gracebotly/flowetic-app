



import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../lib/supabase";
import { extractTenantContext } from "../lib/tenant-verification";
import { AuthenticatedContextSchema } from "../lib/REQUEST_CONTEXT_CONTRACT";

export const updateJourneySchemaReady = createTool({
  id: "updateJourneySchemaReady",
  description:
    "Marks journey session schemaReady=true for tenant/thread. Uses journey_sessions as source of truth for gating.",
  requestContextSchema: AuthenticatedContextSchema,
  inputSchema: z.object({
    threadId: z.string().min(1),
    schemaReady: z.boolean(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
  }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[updateJourneySchemaReady]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const { threadId, schemaReady } = inputData;
    const supabase = createAuthenticatedClient(accessToken);

    // Try common column names. If your schema differs, adjust in a follow-up.
    // Attempt 1: schema_ready boolean column
    {
      const { error } = await supabase
        .from("journey_sessions")
        .update({ schema_ready: schemaReady })
        .eq("tenant_id", tenantId)
        .eq("thread_id", threadId);

      if (!error) return { ok: true };
      // If column doesn't exist, Postgres error will be returned; continue fallback.
      const msg = String(error.message || "");
      const isMissingColumn = msg.toLowerCase().includes("schema_ready") && msg.toLowerCase().includes("column");
      if (!isMissingColumn) {
        throw new Error(`JOURNEY_SCHEMA_READY_UPDATE_FAILED: ${error.message}`);
      }
    }

    // Attempt 2: state_json JSONB column
    {
      // Read existing
      const { data, error } = await supabase
        .from("journey_sessions")
        .select("id,state_json")
        .eq("tenant_id", tenantId)
        .eq("thread_id", threadId)
        .maybeSingle();

      if (error) throw new Error(`JOURNEY_SESSION_LOAD_FAILED: ${error.message}`);
      if (!data?.id) throw new Error("JOURNEY_SESSION_NOT_FOUND");

      const state = (data as any).state_json ?? {};
      const next = { ...state, schemaReady };

      const { error: upErr } = await supabase
        .from("journey_sessions")
        .update({ state_json: next })
        .eq("id", data.id);

      if (upErr) throw new Error(`JOURNEY_STATE_JSON_UPDATE_FAILED: ${upErr.message}`);
      return { ok: true };
    }
  },
});


