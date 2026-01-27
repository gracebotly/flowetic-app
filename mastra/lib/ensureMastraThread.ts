
```ts
import { Memory } from "@mastra/memory";
import { createClient } from "@/lib/supabase/server";
import { getMastraStorage } from "./storage";

export async function ensureMastraThreadId(params: {
  tenantId: string;
  journeyThreadId: string;
  resourceId: string;
  title?: string;
}): Promise<string> {
  const supabase = await createClient();

  const { data: session, error: sessionErr } = await supabase
    .from("journey_sessions")
    .select("mastra_thread_id")
    .eq("tenant_id", params.tenantId)
    .eq("thread_id", params.journeyThreadId)
    .maybeSingle();

  if (sessionErr) {
    throw new Error("ensureMastraThreadId: failed reading journey_sessions: " + String(sessionErr.message || sessionErr));
  }

  if (session?.mastra_thread_id) {
    return session.mastra_thread_id;
  }

  const storage = getMastraStorage();

  const memory = new Memory({
    storage,
  });

  const thread = await memory.createThread({
    resourceId: params.resourceId,
    title: params.title || "Conversation",
    metadata: { journeyThreadId: params.journeyThreadId },
  });

  const mastraThreadId = thread?.id;
  if (!mastraThreadId) {
    throw new Error("ensureMastraThreadId: Memory.createThread returned no id");
  }

  const { error: updErr } = await supabase
    .from("journey_sessions")
    .update({ mastra_thread_id: mastraThreadId })
    .eq("tenant_id", params.tenantId)
    .eq("thread_id", params.journeyThreadId);

  if (updErr) {
    throw new Error("ensureMastraThreadId: failed updating journey_sessions: " + String(updErr.message || updErr));
  }

  return mastraThreadId;
}


