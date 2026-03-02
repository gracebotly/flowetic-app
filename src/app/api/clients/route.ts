import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ClientRow = {
  id: string;
  [key: string]: unknown;
};

type OfferingRow = {
  client_id: string | null;
};

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return membership?.tenant_id ?? null;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("q")?.trim() || null;
  const sortBy = searchParams.get("sort") || "updated_at";
  const includeArchived = searchParams.get("archived") === "true";

  let query = supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .order(sortBy, { ascending: sortBy === "name", nullsFirst: false });

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  if (status === "active" || status === "paused") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data: clients, error } = await query;

  if (error) {
    console.error("[GET /api/clients] Query failed:", error);
    return json(500, { ok: false, code: "QUERY_FAILED", message: error.message });
  }

  const clientRows = (clients ?? []) as ClientRow[];
  const clientIds = clientRows.map((c) => c.id);
  const offeringCounts: Record<string, number> = {};
  let totalOfferings = 0;

  if (clientIds.length > 0) {
    const { data: offerings } = await supabase
      .from("offerings")
      .select("id, client_id")
      .eq("tenant_id", tenantId)
      .neq("status", "archived");

    const offeringRows = (offerings ?? []) as OfferingRow[];
    totalOfferings = offeringRows.length;

    for (const o of offeringRows) {
      if (o.client_id) {
        offeringCounts[o.client_id] = (offeringCounts[o.client_id] || 0) + 1;
      }
    }
  } else {
    const { count } = await supabase
      .from("offerings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "archived");
    totalOfferings = count ?? 0;
  }

  const enriched = clientRows.map((c) => ({
    ...c,
    offering_count: offeringCounts[c.id] || 0,
  }));

  return json(200, { ok: true, clients: enriched, total_offerings: totalOfferings });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length < 2) {
    return json(400, { ok: false, code: "INVALID_NAME", message: "Name must be at least 2 characters." });
  }

  const company = typeof body.company === "string" ? body.company.trim() || null : null;
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : null;
  const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().toLowerCase())
    : [];

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenantId,
      name,
      company,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      notes,
      tags,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/clients] Insert failed:", error);
    return json(500, { ok: false, code: "INSERT_FAILED", message: error.message });
  }

  return json(201, { ok: true, client });
}
