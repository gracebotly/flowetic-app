
import { Memory } from "@mastra/memory";
import { createClient } from "@/lib/supabase/server";
import { getMastraStorage } from "./storage";
import { safeUuid } from "./safeUuid";

export async function ensureMastraThreadId(params: {
  tenantId: string;
  journeyThreadId: string;
  resourceId: string;
  title?: string;
  // NEW: Optional context for auto-creating session
  platformType?: string;
  sourceId?: string;
  entityId?: string;
}): Promise<string> {
  const supabase = await createClient();

  // 1. Try to find existing session
  const { data: session, error: sessionErr } = await supabase
    .from("journey_sessions")
    .select("id, mastra_thread_id")
    .eq("tenant_id", params.tenantId)
    .eq("thread_id", params.journeyThreadId)
    .maybeSingle();

  if (sessionErr) {
    throw new Error("ensureMastraThreadId: failed reading journey_sessions: " + String(sessionErr.message || sessionErr));
  }

  // 2. If session exists and has mastra_thread_id, return it
  if (session?.mastra_thread_id) {
    return session.mastra_thread_id;
  }

  // 3. Create Mastra thread
  const storage = getMastraStorage();

  const memory = new Memory({
    storage,
  });

  const thread = await memory.createThread({
    resourceId: params.resourceId,
    title: params.title || "Conversation",
    metadata: { journeyThreadId: params.journeyThreadId },
  });

  const rawMastraThreadId = thread?.id;
  // Sanitize thread ID — upstream may pass composite 'sourceId:externalId' format
  const mastraThreadId = safeUuid(rawMastraThreadId, 'mastraThreadId');
  if (!mastraThreadId) {
    throw new Error("ensureMastraThreadId: Memory.createThread returned invalid thread id: " + String(rawMastraThreadId));
  }

  // 4. UPSERT: Create session if it doesn't exist, or update if it does
  if (!session) {
    // Session doesn't exist - CREATE it
    // IMPORTANT: Validate UUIDs before inserting to prevent Postgres errors
    const safeSourceId = safeUuid(params.sourceId, 'sourceId');
    const safeEntityId = safeUuid(params.entityId, 'entityId');

    console.log('[ensureMastraThreadId] Creating new journey_sessions row:', {
      tenantId: params.tenantId,
      journeyThreadId: params.journeyThreadId,
      mastraThreadId,
      sourceId: safeSourceId,
      entityId: safeEntityId,
    });

    const now = new Date().toISOString();
    const { error: insertErr } = await supabase
      .from("journey_sessions")
      .insert({
        tenant_id: params.tenantId,
        thread_id: params.journeyThreadId,
        mastra_thread_id: mastraThreadId,
        platform_type: params.platformType || "other",
        source_id: safeSourceId,  // Use validated UUID or null
        entity_id: safeEntityId,  // Use validated UUID or null
        mode: "select_entity",
        density_preset: "comfortable",
        // DO NOT persist entityId as selected_entities here.
        // entityId is the source_entity UUID (e.g. "8e538b26-..."), NOT a user
        // entity selection (which should be display names like "Chat Session, Daily Analytics Report").
        // selected_entities is populated later by working memory → DB sync in onFinish
        // or by client-side persistence in route.ts when the user actually picks entities.
        selected_entities: null,
        created_at: now,
        updated_at: now,
      });

    if (insertErr) {
      // Handle race condition: another request may have created it
      if (insertErr.code === '23505') { // unique_violation
        console.log('[ensureMastraThreadId] Race condition: session already exists, updating instead');
        const { error: raceUpdateErr } = await supabase
          .from("journey_sessions")
          .update({ mastra_thread_id: mastraThreadId, updated_at: now })
          .eq("tenant_id", params.tenantId)
          .eq("thread_id", params.journeyThreadId);

        if (raceUpdateErr) {
          console.error('[ensureMastraThreadId] Failed to update after race:', raceUpdateErr);
        }
      } else {
        throw new Error("ensureMastraThreadId: failed inserting journey_sessions: " + String(insertErr.message || insertErr));
      }
    }
  } else {
    // Session exists but no mastra_thread_id - UPDATE it
    console.log('[ensureMastraThreadId] Updating existing journey_sessions row:', {
      sessionId: session.id,
      mastraThreadId,
    });

    const { data: updateResult, error: updErr } = await supabase
      .from("journey_sessions")
      .update({
        mastra_thread_id: mastraThreadId,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", params.tenantId)
      .eq("thread_id", params.journeyThreadId)
      .select("id")
      .maybeSingle();

    if (updErr) {
      throw new Error("ensureMastraThreadId: failed updating journey_sessions: " + String(updErr.message || updErr));
    }

    if (!updateResult) {
      console.error('[ensureMastraThreadId] Update matched 0 rows - this should not happen');
    }
  }

  return mastraThreadId;
}


