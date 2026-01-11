
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sourceId = String(searchParams.get("sourceId") || "").trim();
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  const { data: source, error: sErr } = await supabase
    .from("sources")
    .select("id, tenant_id, type, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: sErr.message }, { status: 500 });
  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (String(source.type) !== "make") return NextResponse.json({ ok: false, code: "MAKE_SOURCE_REQUIRED" }, { status: 400 });

  const decrypted = source.secret_hash ? decryptSecret(String(source.secret_hash)) : "";
  let secretJson: any = null;
  try { secretJson = decrypted ? JSON.parse(decrypted) : null; } catch { secretJson = null; }

  const apiKey = String(secretJson?.apiKey || "").trim();
  const region = String(secretJson?.region || "").trim(); // expected like "us1/us2/eu1/eu2"
  if (!apiKey) return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });
  if (!region) return NextResponse.json({ ok: false, code: "MISSING_REGION", message: "Make region is required." }, { status: 400 });

  // Fetch organizations first
  const orgRes = await fetch(`https://${region}.make.com/api/v2/organizations`, {
    method: "GET",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
  });

  const orgText = await orgRes.text().catch(() => "");
  if (!orgRes.ok) {
    return NextResponse.json(
      { ok: false, code: "MAKE_ORGANIZATIONS_FAILED", message: `Failed to fetch organizations (${orgRes.status}).` , details: { providerBodySnippet: orgText.slice(0, 300) } },
      { status: 400 },
    );
  }

  let orgJson: any = null;
  try { orgJson = orgText ? JSON.parse(orgText) : null; } catch { orgJson = null; }
  const organizations = Array.isArray(orgJson?.organizations) ? orgJson.organizations : [];
  if (organizations.length === 0) {
    return NextResponse.json({ ok: false, code: "MAKE_NO_ORGANIZATION", message: "No organizations found for this token." }, { status: 400 });
  }

  // Find an org that allows scenarios listing
  let scenariosText = "";
  let scenariosRes: Response | null = null;
  for (const org of organizations) {
    const orgId = org?.id;
    if (!orgId) continue;
    const tryRes = await fetch(`https://${region}.make.com/api/v2/scenarios?organizationId=${encodeURIComponent(String(orgId))}`, {
      method: "GET",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
    });
    const t = await tryRes.text().catch(() => "");
    if (tryRes.ok) {
      scenariosRes = tryRes;
      scenariosText = t;
      break;
    }
    // keep trying; 403 is common if token/org mismatch
  }

  if (!scenariosRes) {
    return NextResponse.json(
      { ok: false, code: "MAKE_SCENARIOS_FAILED", message: "Failed to fetch scenarios for any organization." },
      { status: 400 },
    );
  }

  let parsed: any = null;
  try { parsed = scenariosText ? JSON.parse(scenariosText) : null; } catch { parsed = null; }
  const scenarios = Array.isArray(parsed?.scenarios) ? parsed.scenarios : Array.isArray(parsed) ? parsed : [];

  const inventoryEntities = scenarios.map((s: any) => ({
    entityKind: "scenario",
    externalId: String(s?.id ?? ""),
    displayName: String(s?.name ?? `Scenario ${String(s?.id ?? "")}`),
  })).filter((x: any) => x.externalId);

  return NextResponse.json({ ok: true, inventoryEntities });
}

