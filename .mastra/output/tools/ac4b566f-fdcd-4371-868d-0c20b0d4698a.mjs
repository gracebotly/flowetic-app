import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const updateJourneySchemaReady = createTool({
  id: "updateJourneySchemaReady",
  description: "Marks journey session schemaReady=true for tenant/thread. Uses journey_sessions as source of truth for gating.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    schemaReady: z.boolean()
  }),
  outputSchema: z.object({
    ok: z.boolean()
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { tenantId, threadId, schemaReady } = inputData;
    {
      const { error } = await supabase.from("journey_sessions").update({ schema_ready: schemaReady }).eq("tenant_id", tenantId).eq("thread_id", threadId);
      if (!error) return { ok: true };
      const msg = String(error.message || "");
      const isMissingColumn = msg.toLowerCase().includes("schema_ready") && msg.toLowerCase().includes("column");
      if (!isMissingColumn) {
        throw new Error(`JOURNEY_SCHEMA_READY_UPDATE_FAILED: ${error.message}`);
      }
    }
    {
      const { data, error } = await supabase.from("journey_sessions").select("id,state_json").eq("tenant_id", tenantId).eq("thread_id", threadId).maybeSingle();
      if (error) throw new Error(`JOURNEY_SESSION_LOAD_FAILED: ${error.message}`);
      if (!data?.id) throw new Error("JOURNEY_SESSION_NOT_FOUND");
      const state = data.state_json ?? {};
      const next = { ...state, schemaReady };
      const { error: upErr } = await supabase.from("journey_sessions").update({ state_json: next }).eq("id", data.id);
      if (upErr) throw new Error(`JOURNEY_STATE_JSON_UPDATE_FAILED: ${upErr.message}`);
      return { ok: true };
    }
  }
});

export { updateJourneySchemaReady };
