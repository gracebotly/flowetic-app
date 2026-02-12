

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const getJourneySession = createTool({
  id: "journey.getSession",
  description: "Get the current journey session. threadId is automatically provided via server context - do NOT pass it as input.",
  inputSchema: z.object({}),
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
    previewVersionId: z.string().nullable(),
  }),
  execute: async (_inputData, context) => {
    // The route.ts sets both:
    //   requestContext.set('threadId', mastraThreadId)              ← Mastra internal UUID
    //   requestContext.set('journeyThreadId', clientJourneyThreadId) ← Client journey UUID
    //
    // CRITICAL: These map to DIFFERENT columns in journey_sessions:
    //   - journeyThreadId → journey_sessions.thread_id
    //   - threadId (Mastra) → journey_sessions.mastra_thread_id
    const journeyThreadId = context?.requestContext?.get('journeyThreadId') as string | undefined;
    const mastraThreadId = context?.requestContext?.get('threadId') as string | undefined;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Determine which ID and column to use
    let queryColumn: 'thread_id' | 'mastra_thread_id';
    let queryValue: string;

    if (journeyThreadId && UUID_RE.test(journeyThreadId)) {
      // Primary path: use client journey UUID → thread_id column
      queryColumn = 'thread_id';
      queryValue = journeyThreadId;
    } else if (mastraThreadId && UUID_RE.test(mastraThreadId)) {
      // Fallback path: use Mastra UUID → mastra_thread_id column
      queryColumn = 'mastra_thread_id';
      queryValue = mastraThreadId;
    } else {
      // No valid ID available
      const debugInfo = `journeyThreadId="${journeyThreadId}", threadId="${mastraThreadId}"`;
      console.error(`[getJourneySession] No valid UUID in RequestContext: ${debugInfo}`);
      throw new Error(`getJourneySession: No valid threadId in RequestContext. ${debugInfo}`);
    }

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getJourneySession]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { data, error } = await supabase
      .from("journey_sessions")
      .select(
        "tenant_id,thread_id,platform_type,source_id,entity_id,mode,schema_ready,selected_outcome,selected_storyboard,selected_style_bundle_id,preview_interface_id,preview_version_id",
      )
      .eq("tenant_id", tenantId)
      .eq(queryColumn, queryValue)  // ✅ Query the CORRECT column
      .maybeSingle();

    if (error) {
      console.error('[getJourneySession] DB error:', error.message);
      throw new Error(error.message);
    }
    if (!data) {
      console.error('[getJourneySession] Session not found:', {
        queryColumn,
        queryValue,
        tenantId,
        journeyThreadId,
        mastraThreadId,
        hint: 'This usually means ensureMastraThreadId failed to create the session row. Check if journey_sessions INSERT is working.',
      });
      throw new Error(`JOURNEY_SESSION_NOT_FOUND: No session with ${queryColumn}=${queryValue} for tenant ${tenantId}`);
    }

    return {
      tenantId: data.tenant_id,
      threadId: data.thread_id,
      platformType: String(data.platform_type || "other"),
      sourceId: data.source_id ? String(data.source_id) : null,
      entityId: data.entity_id ? String(data.entity_id) : null,
      mode: String(data.mode || "select_entity"),
      schemaReady: Boolean((data as any).schema_ready),
      selectedOutcome: data.selected_outcome ? String(data.selected_outcome) : null,
      selectedStoryboard: data.selected_storyboard ? String(data.selected_storyboard) : null,
      selectedStyleBundleId: data.selected_style_bundle_id ? String(data.selected_style_bundle_id) : null,
      previewInterfaceId: data.preview_interface_id ? String(data.preview_interface_id) : null,
      previewVersionId: data.preview_version_id ? String(data.preview_version_id) : null,
    };
  },
});



