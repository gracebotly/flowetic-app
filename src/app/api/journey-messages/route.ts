

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const AppendSchema = z.object({
  tenantId: z.string().uuid(),
  threadId: z.string().min(1),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const threadId = url.searchParams.get("threadId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 200);

  if (!tenantId || !threadId) {
    return NextResponse.json({ ok: false, error: "MISSING_PARAMS" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("journey_messages")
    .select("id,role,content,created_at")
    .eq("tenant_id", tenantId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);
  const parsed = AppendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const { tenantId, threadId, role, content } = parsed.data;

  const { error } = await supabase.from("journey_messages").insert({
    tenant_id: tenantId,
    thread_id: threadId,
    role,
    content,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // bump updated_at on journey_sessions
  await supabase
    .from("journey_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("thread_id", threadId);

  return NextResponse.json({ ok: true });
}


