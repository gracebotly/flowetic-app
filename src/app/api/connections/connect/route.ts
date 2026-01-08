
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/secrets";
import { validateMcpServer } from "@/lib/mcp/validateMcpServer";

export const runtime = "nodejs";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";

const MAKE_REGIONS = ["us1", "eu1", "us2", "eu2"] as const;
type MakeRegion = (typeof MAKE_REGIONS)[number];

async function detectMakeRegion(apiToken: string): Promise<MakeRegion | null> {
  for (const region of MAKE_REGIONS) {
    try {
      const res = await fetch(`https://${region}.make.com/api/v2/scenarios`, {
        method: "GET",
        headers: {
          Authorization: `Token ${apiToken}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) return region;
    } catch {
      // try next region
    }
  }
  return null;
}

async function validateMakeRegion(apiToken: string, region: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`https://${region}.make.com/api/v2/scenarios`, {
      method: "GET",
      headers: {
        Authorization: `Token ${apiToken}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return res.ok;
  } catch (error) {
    console.error(`[Make Region Validation] Failed for ${region}:`, error);
    return false;
  }
}

type MakeScenarioListResponse = {
  scenarios?: Array<{
    id: number | string;
    name?: string;
  }>;
};

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as any;

  const platformType = body.platformType as PlatformType | undefined;
  const connectionName = (body.name as string | undefined) ?? "";
  const method = (body.method as "api" | "webhook" | "mcp" | undefined) ?? "api";
  const region = (body.region as string | undefined) ?? undefined;

  if (!platformType) {
    return NextResponse.json({ ok: false, code: "MISSING_PLATFORM_TYPE" }, { status: 400 });
  }

  const methodStatus =
    method === "webhook" ? "method:webhook" : method === "mcp" ? "method:mcp" : "method:api";

  // Credentials payload to encrypt into sources.secret_hash
  // NOTE: we store a JSON string inside the encrypted envelope.
  let secretJson: any = { method, platformType };

  if (method === "api") {
    const apiKey = (body.apiKey as string | undefined) ?? "";
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;

    if (!apiKey) {
      return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });
    }

    if (platformType === "make") {
      // Use user-provided region if available, otherwise auto-detect
      let makeRegion: string;
      
      if (region && ['us1', 'us2', 'eu1', 'eu2'].includes(region)) {
        // User selected region - validate it works
        const isValid = await validateMakeRegion(apiKey, region);
        if (!isValid) {
          return NextResponse.json(
            { error: `Invalid API token for ${region.toUpperCase()} region. Please check your token and region.` },
            { status: 400 }
          );
        }
        makeRegion = region;
      } else {
        // Fallback to auto-detection (legacy support)
        const detectedRegion = await detectMakeRegion(apiKey);
        if (!detectedRegion) {
          return NextResponse.json(
            { error: "Could not detect Make.com region. Please select your region manually." },
            { status: 400 }
          );
        }
        makeRegion = detectedRegion;
      }
      
      // Store token + region in secret_json (encrypted in sources.secret_hash)
      secretJson = { ...secretJson, apiKey, region: makeRegion };

      // Override name to match required format
      (body as any).__computedName = `Make (${makeRegion.toUpperCase()})`;
    } else {
      // Existing behavior for other API platforms (n8n, activepieces, etc.)
      const authMode =
        platformType === "n8n"
          ? ((body.n8nAuthMode as "header" | "bearer" | undefined) ?? "bearer")
          : undefined;

      secretJson = { ...secretJson, apiKey, instanceUrl, ...(authMode ? { authMode } : {}) };
    }
  }

  if (method === "webhook") {
    // webhook-only means user will configure sending events to GetFlowetic later
    // Still store instanceUrl if provided for self-hosted platforms (n8n/activepieces)
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;
    secretJson = { ...secretJson, instanceUrl };
  }

  if (method === "mcp") {
    const mcpUrl = (body.mcpUrl as string | undefined) ?? "";
    const authHeader = (body.authHeader as string | undefined) ?? "";
    if (!mcpUrl) {
      return NextResponse.json({ ok: false, code: "MISSING_MCP_URL" }, { status: 400 });
    }

    const validation = await validateMcpServer({
      serverId: `${platformType}-mcp`,
      url: mcpUrl,
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, code: "MCP_VALIDATION_FAILED", message: validation.error },
        { status: 400 },
      );
    }

    secretJson = {
      ...secretJson,
      mcpUrl,
      authHeader: authHeader || null,
      toolCount: validation.toolCount ?? 0,
    };
  }
  
  if (platformType === "n8n" && method === "api") {
    const baseUrl = (() => {
      try {
        if (secretJson.instanceUrl) return new URL(secretJson.instanceUrl).origin;
        return null;
      } catch {
        return null;
      }
    })();

    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, code: "MISSING_INSTANCE_URL", message: "n8n instance URL is required." },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secretJson.authMode === "header") {
      headers["X-N8N-API-KEY"] = secretJson.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${secretJson.apiKey}`;
    }

    const testRes = await fetch(`${baseUrl}/api/v1/workflows`, { method: "GET", headers });
    if (!testRes.ok) {
      const t = await testRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, code: "N8N_API_FAILED", message: `n8n API auth failed (${testRes.status}). ${t}`.trim() },
        { status: 400 },
      );
    }
  }


  // IMPORTANT: sources table has NO updated_at, so never set it here.
  const { data: source, error } = await supabase
    .from("sources")
    .upsert(
      {
        tenant_id: membership.tenant_id,
        type: platformType,
        name: ((((body as any).__computedName as string | undefined) ?? connectionName) || platformType),
        status: "active",
        method: method,
        secret_hash: encryptSecret(JSON.stringify(secretJson)),
      },
      { 
        // For n8n, allow multiple connections by only conflicting on name
        // For other platforms, continue to enforce uniqueness as before
        onConflict: platformType === "n8n" ? "tenant_id,name" : "tenant_id,type,method" 
      },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });
  }

  if (platformType === "make" && method === "api") {
    const region = (secretJson?.region as MakeRegion | undefined) ?? null;

    if (!region) {
      return NextResponse.json({ ok: true, source });
    }

    const scenariosRes = await fetch(`https://${region}.make.com/api/v2/scenarios`, {
      method: "GET",
      headers: {
        Authorization: `Token ${secretJson.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!scenariosRes.ok) {
      const t = await scenariosRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          code: "MAKE_SCENARIOS_FAILED",
          message: `Failed to fetch scenarios (${scenariosRes.status}). ${t}`.trim(),
        },
        { status: 400 },
      );
    }

    const scenariosJson = (await scenariosRes.json().catch(() => ({}))) as MakeScenarioListResponse;
    const scenarios = scenariosJson.scenarios ?? [];

    const inventoryEntities = scenarios.map((s) => ({
      externalId: String(s.id),
      displayName: String(s.name ?? `Scenario ${String(s.id)}`),
      entityKind: "scenario",
    }));

    return NextResponse.json({
      ok: true,
      source,
      inventoryEntities,
      meta: { region },
    });
  }

  return NextResponse.json({ ok: true, source });
}
