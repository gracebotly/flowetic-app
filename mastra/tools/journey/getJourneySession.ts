

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
    // Use journeyThreadId (the client-side UUID stored in journey_sessions.thread_id)
    // NOT threadId (which is the Mastra internal thread UUID from ensureMastraThreadId)
    // The route.ts sets both:
    //   requestContext.set('threadId', mastraThreadId)        ← Mastra internal, NOT in journey_sessions
    //   requestContext.set('journeyThreadId', clientJourneyThreadId)  ← matches journey_sessions.thread_id
    // Try journeyThreadId first (the client UUID matching journey_sessions.thread_id)
    // Fall back to threadId (Mastra internal thread) only if journeyThreadId is missing/invalid
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let threadId = context?.requestContext?.get('journeyThreadId') as string;

    if (!threadId || !UUID_RE.test(threadId)) {
      // journeyThreadId missing or invalid (e.g. "vibe" from URL path corruption)
      // Try threadId as fallback
      const fallback = context?.requestContext?.get('threadId') as string;
      if (fallback && UUID_RE.test(fallback)) {
        console.warn(`[getJourneySession] journeyThreadId invalid ("${threadId}"), using threadId fallback: "${fallback?.substring(0, 8)}..."`);
        threadId = fallback;
      }
    }

    if (!threadId || !UUID_RE.test(threadId)) {
      // Log all available RequestContext keys for debugging
      const availableKeys: string[] = [];
      const keysToCheck = ['journeyThreadId', 'threadId', 'tenantId', 'userId', 'phase', 'sourceId'];
      for (const k of keysToCheck) {
        const v = context?.requestContext?.get(k);
        if (v) availableKeys.push(`${k}=${String(v).substring(0, 12)}`);
      }
      console.error(`[getJourneySession] No valid UUID threadId found. journeyThreadId="${threadId}", available: [${availableKeys.join(', ')}]`);
      throw new Error(`[getJourneySession] No valid threadId. Got: "${threadId}". This may indicate RequestContext corruption during sub-agent delegation.`);
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
      .eq("thread_id", threadId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("JOURNEY_SESSION_NOT_FOUND");

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



