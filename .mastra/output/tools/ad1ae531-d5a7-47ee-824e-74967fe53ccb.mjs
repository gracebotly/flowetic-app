import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const getJourneySession = createTool({
  id: "journey.getSession",
  description: "Fetch journey session state for tenant/thread (source of truth for schemaReady).",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1)
  }),
  outputSchema: z.object({
    tenantId: z.string(),
    threadId: z.string(),
    platformType: z.string(),
    sourceId: z.string().nullable(),
    entityId: z.string().nullable(),
    mode: z.string(),
    schemaReady: z.boolean(),
    selectedOutcome: z.string().nullable(),
    selectedStoryboard: z.string().nullable(),
    selectedStyleBundleId: z.string().nullable(),
    previewInterfaceId: z.string().nullable(),
    previewVersionId: z.string().nullable()
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("journey_sessions").select(
      "tenant_id,thread_id,platform_type,source_id,entity_id,mode,schema_ready,selected_outcome,selected_storyboard,selected_style_bundle_id,preview_interface_id,preview_version_id"
    ).eq("tenant_id", inputData.tenantId).eq("thread_id", inputData.threadId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("JOURNEY_SESSION_NOT_FOUND");
    return {
      tenantId: data.tenant_id,
      threadId: data.thread_id,
      platformType: String(data.platform_type || "other"),
      sourceId: data.source_id ? String(data.source_id) : null,
      entityId: data.entity_id ? String(data.entity_id) : null,
      mode: String(data.mode || "select_entity"),
      schemaReady: Boolean(data.schema_ready),
      selectedOutcome: data.selected_outcome ? String(data.selected_outcome) : null,
      selectedStoryboard: data.selected_storyboard ? String(data.selected_storyboard) : null,
      selectedStyleBundleId: data.selected_style_bundle_id ? String(data.selected_style_bundle_id) : null,
      previewInterfaceId: data.preview_interface_id ? String(data.preview_interface_id) : null,
      previewVersionId: data.preview_version_id ? String(data.preview_version_id) : null
    };
  }
});

export { getJourneySession };
