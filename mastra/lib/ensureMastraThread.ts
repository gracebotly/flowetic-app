

import { getMastraStorage } from "./storage";
import { createClient } from "@/lib/supabase/server";

export async function ensureMastraThreadId(params: {
  tenantId: string;
  journeyThreadId: string;
  resourceId: string; // use tenantId if you don't have a separate user resource id
  title?: string;
}): Promise<string> {
  const supabase = await createClient();

  // 1) read session
  const { data: session, error: sessionErr } = await supabase
    .from("journey_sessions")
    .select("mastra_thread_id")
    .eq("tenant_id", params.tenantId)
    .eq("thread_id", params.journeyThreadId)
    .maybeSingle();

  if (sessionErr) {
    throw new Error(`ensureMastraThreadId: failed reading journey_session: ${sessionErr.message}`);
  }

  if (session?.mastra_thread_id) {
    return session.mastra_thread_id;
  }

  // 2) create Mastra thread in storage (UUID-backed)
  const storage = getMastraStorage();
  await storage.init();

  const memoryStore = await storage.getStore("memory");
  if (!memoryStore) throw new Error("ensureMastraThreadId: memory store unavailable");

  const created = await memoryStore.createThread({
    resourceId: params.resourceId,
    title: params.title || "Conversation",
    metadata: JSON.stringify({ journeyThreadId: params.journeyThreadId }),
  });

  const mastraThreadId = created?.id;
  if (!mastraThreadId) throw new Error("ensureMastraThreadId: createThread returned no id");

  // 3) persist mapping
  const { error: updErr } = await supabase
    .from("journey_sessions")
    .update({ mastra_thread_id: mastraThreadId })
    .eq("tenant_id", params.tenantId)
    .eq("thread_id", params.journeyThreadId);

  if (updErr) {
    throw new Error(`ensureMastraThreadId: failed updating journey_session: ${updErr.message}`);
  }

  return mastraThreadId;
}

