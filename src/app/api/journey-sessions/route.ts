

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  platformType: z.enum(["retell", "make", "n8n", "vapi", "activepieces", "other"]).default("other"),
  sourceId: z.string().uuid(),
  entityId: z.string().uuid(), // workflow entity_id from source_entities
  threadId: z.string().min(1),
  title: z.string().min(1).max(120),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const userId = url.searchParams.get("userId");

  if (!tenantId || !userId) {
    return NextResponse.json({ ok: false, error: "MISSING_AUTH_CONTEXT" }, { status: 400 });
  }

  // MVP: per-user conversations = filter by tenant_id, and later join a membership/user mapping.
  // For now, we scope by tenant_id only if that's how your auth is modeled.
  const { data, error } = await supabase
    .from("journey_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const { tenantId, platformType, sourceId, entityId, threadId, title } = parsed.data;

  const now = new Date().toISOString();
  const insert = {
    tenant_id: tenantId,
    thread_id: threadId,
    platform_type: platformType,
    source_id: sourceId,
    entity_id: entityId,
    mode: "select_entity",
    density_preset: "comfortable",
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("journey_sessions")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // store title as first system message for now (no title column in schema)
  const { error: msgErr } = await supabase.from("journey_messages").insert({
    tenant_id: tenantId,
    thread_id: threadId,
    role: "system",
    content: `Conversation: ${title}`,
  });

  if (msgErr) {
    // non-fatal
  }

  return NextResponse.json({ ok: true, session: data });
}

