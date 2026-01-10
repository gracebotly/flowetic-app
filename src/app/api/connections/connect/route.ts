
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
    
    console.log(`[Make] Testing region ${region} with API token`);
    
    // Make.com requires organizationId or teamId parameter
    // First, get organizations to find the organization ID
    const orgRes = await fetch(`https://${region}.make.com/api/v2/organizations`, {
      method: "GET",
      headers: {
        Authorization: `Token ${apiToken}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!orgRes.ok) {
      const responseText = await orgRes.text().catch(() => '');
      console.error('[Make API Error - Organizations]', {
        status: orgRes.status,
        statusText: orgRes.statusText,
        headers: Object.fromEntries(orgRes.headers.entries()),
        body: responseText,
        region,
        url: `https://${region}.make.com/api/v2/organizations`,
        authHeader: `Token ${apiToken.substring(0, 8)}...`
      });
    }

    const orgs = await orgRes.json().catch(() => ({}));
    console.log('[Make] Organizations response:', orgs);

    // Try each organization until we find one that works
    const organizations = orgs.organizations || [];

    if (organizations.length === 0) {
      console.error('[Make] No organization found:', {
        organizations: orgs,
        region
      });
      return false;
    }

    console.log(`[Make] Found ${organizations.length} organizations, trying each...`);

    let res: Response | null = null;
    let workingOrgId: number | string | null = null;

    for (const org of organizations) {
      console.log(`[Make] Testing organization: ${org.id} (${org.name})`);
      
      const tryRes = await fetch(`https://${region}.make.com/api/v2/scenarios?organizationId=${org.id}`, {
        method: "GET",
        headers: {
          Authorization: `Token ${apiToken}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (tryRes.ok) {
        console.log(`[Make] ✓ Organization ${org.id} (${org.name}) works!`);
        res = tryRes;
        workingOrgId = org.id;
        break;
      } else if (tryRes.status === 403) {
        console.log(`[Make] ✗ Organization ${org.id} (${org.name}) forbids token auth, trying next...`);
        continue;
      } else {
        // Other error - might want to try next org
        const errText = await tryRes.text().catch(() => '');
        console.log(`[Make] ✗ Organization ${org.id} (${org.name}) error ${tryRes.status}: ${errText}`);
        continue;
      }
    }

    clearTimeout(timeout);

    if (!res || !workingOrgId) {
      console.error(`[Make] None of ${organizations.length} organizations worked`);
      return false;
    }

    const finalRes = res; // for TypeScript
    
    if (!finalRes.ok) {
      const responseText = await finalRes.text().catch(() => '');
      console.error('[Make API Error]', {
        status: finalRes.status,
        statusText: finalRes.statusText,
        headers: Object.fromEntries(finalRes.headers.entries()),
        body: responseText,
        region,
        organizationId: workingOrgId,
        url: `https://${region}.make.com/api/v2/scenarios?organizationId=${workingOrgId}`,
        authHeader: `Token ${apiToken.substring(0, 8)}...`
      });
    }
    
    return finalRes.ok;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[Make Region Validation] Failed for ${region}:`, {
      error: err.message,
      name: err.name,
      stack: err.stack,
      region
    });
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
  
  // Support both apiToken (legacy) and apiKey (new frontend) parameter names
  const apiToken = body.apiToken || body.apiKey;

  // Debug logging for troubleshooting
  console.log('[Make Connection Debug]', {
    platformType,
    hasToken: !!apiToken,
    tokenLength: apiToken?.length,
    method,
    region,
    bodyKeys: Object.keys(body),
    fullBody: body
  });

  if (!platformType) {
    return NextResponse.json({ ok: false, code: "MISSING_PLATFORM_TYPE" }, { status: 400 });
  }

  // Enforce Make API-only - webhook connections are no longer supported
  if (platformType === "make" && method !== "api") {
    return NextResponse.json(
      {
        ok: false,
        code: "MAKE_API_ONLY",
        message: "Make connections require API method. Webhook connections are not supported.",
      },
      { status: 400 },
    );
  }

  const methodStatus =
    method === "webhook" ? "method:webhook" : method === "mcp" ? "method:mcp" : "method:api";

  // Credentials payload to encrypt into sources.secret_hash
  // NOTE: we store a JSON string inside the encrypted envelope.
  let secretJson: any = { method, platformType };

  if (method === "api") {
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;

    if (!apiToken) {
      return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });
    }

    if (platformType === "make") {
      // Use user-provided region if available, otherwise auto-detect
      let makeRegion: string;
      
      console.log('[Make Region Logic]', {
        providedRegion: region,
        isValidRegion: region && ['us1', 'us2', 'eu1', 'eu2'].includes(region),
        regionType: typeof region
      });
      
      if (region && ['us1', 'us2', 'eu1', 'eu2'].includes(region)) {
        // User selected region - validate it works
        console.log(`[Make] Validating user-provided region: ${region}`);
        const isValid = await validateMakeRegion(apiToken, region);
        if (!isValid) {
          // Get the last error from logs to provide more specific error message
          return NextResponse.json(
            { 
              ok: false, 
              code: "MAKE_INVALID_TOKEN", 
              message: `Failed to connect to ${region.toUpperCase()} region. Check your API token has scenarios:read permission and correct region selected.` 
            },
            { status: 400 }
          );
        }
        makeRegion = region;
      } else {
        // Fallback to auto-detection (legacy support)
        console.log(`[Make] No valid region provided, falling back to auto-detection`);
        const detectedRegion = await detectMakeRegion(apiToken);
        if (!detectedRegion) {
          return NextResponse.json(
            { ok: false, code: "MAKE_REGION_DETECTION_FAILED", message: "Could not detect Make.com region. Please select your region manually." },
            { status: 400 }
          );
        }
        console.log(`[Make] Auto-detected region: ${detectedRegion}`);
        makeRegion = detectedRegion;
      }
      
      // Store token + region in secret_json (encrypted in sources.secret_hash)
      secretJson = { ...secretJson, apiKey: apiToken, region: makeRegion };

      // Override name to match required format
      (body as any).__computedName = `Make (${makeRegion.toUpperCase()})`;
    } else {
      // Existing behavior for other API platforms (n8n, activepieces, etc.)
      const authMode =
        platformType === "n8n"
          ? ((body.n8nAuthMode as "header" | "bearer" | undefined) ?? "bearer")
          : undefined;

      secretJson = { ...secretJson, apiKey: apiToken, instanceUrl, ...(authMode ? { authMode } : {}) };
    }
  }

  if (method === "webhook") {
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

  if (platformType === "vapi" && method === "api") {
    const key = String(secretJson?.apiKey || "").trim();
    if (!key) {
      return NextResponse.json({ ok: false, code: "MISSING_API_KEY", message: "Vapi Private API Key is required." }, { status: 400 });
    }

    // Test key with a lightweight request
    const testRes = await fetch("https://api.vapi.ai/v1/assistants", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    if (!testRes.ok) {
      const t = await testRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, code: "VAPI_AUTH_FAILED", message: `Vapi API auth failed (${testRes.status}). ${t}`.trim() },
        { status: 400 },
      );
    }
  }

  if (platformType === "retell" && method === "api") {
    const key = String(secretJson?.apiKey || "").trim();
    if (!key) {
      return NextResponse.json({ ok: false, code: "MISSING_API_KEY", message: "Retell API Key is required." }, { status: 400 });
    }

    // Test key with a lightweight request
    const testRes = await fetch("https://api.retellai.com/list-agents", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    if (!testRes.ok) {
      const t = await testRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, code: "RETELL_AUTH_FAILED", message: `Retell API auth failed (${testRes.status}). ${t}`.trim() },
        { status: 400 },
      );
    }
  }


  // Best-effort pull of recent calls for Vapi
  let callsLoaded: number | null = null;

  if (platformType === "vapi" && method === "api") {
    const key = String(secretJson?.apiKey || "").trim();

    try {
      const callsRes = await fetch("https://api.vapi.ai/v1/calls?limit=100", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      });

      if (callsRes.ok) {
        const callsJson = await callsRes.json().catch(() => null);
        const calls = Array.isArray(callsJson) ? callsJson : Array.isArray(callsJson?.calls) ? callsJson.calls : [];
        callsLoaded = Array.isArray(calls) ? calls.length : 0;

        // OPTIONAL: store each call payload as an event row (raw in state)
        // Keep minimal and safe: insert only if callsLoaded > 0
        if (callsLoaded > 0) {
          const nowIso = new Date().toISOString();
          const rows = calls.map((c: any) => ({
            tenant_id: membership.tenant_id,
            source_id: null, // fill after source insert if needed
            interface_id: null,
            run_id: null,
            type: "state",
            name: "vapi.call",
            value: null,
            unit: null,
            text: null,
            state: c,
            labels: { platform: "vapi", kind: "call", source: "historical_import" },
            timestamp: nowIso,
            created_at: nowIso,
          }));

          // We'll insert after we have sourceId; store rows temporarily
          (globalThis as any).__VAPI_CALL_ROWS__ = rows;
        }
      } else {
        callsLoaded = 0;
      }
    } catch {
      callsLoaded = 0;
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

  // After source creation, insert imported call events (if any)
  if (platformType === "vapi" && method === "api") {
    const rows = (globalThis as any).__VAPI_CALL_ROWS__ as any[] | undefined;
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const withSource = rows.map((r) => ({ ...r, source_id: source.id }));
      await supabase.from("events").insert(withSource);
    }
    (globalThis as any).__VAPI_CALL_ROWS__ = undefined;
  }

  if (platformType === "make" && method === "api") {
    const region = (secretJson?.region as MakeRegion | undefined) ?? null;

    if (!region) {
      return NextResponse.json({ ok: true, sourceId: source.id });
    }

    // Get organizations to find the organization ID for scenarios call
    console.log(`[Make] Getting organizations for inventory from region ${region}`);
    const orgRes = await fetch(`https://${region}.make.com/api/v2/organizations`, {
      method: "GET",
      headers: {
        Authorization: `Token ${secretJson.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!orgRes.ok) {
      const t = await orgRes.text().catch(() => "");
      console.error('[Make API Error - Organizations for Inventory]', {
        status: orgRes.status,
        body: t,
        region
      });
      return NextResponse.json(
        {
          ok: false,
          code: "MAKE_ORGANIZATIONS_FAILED",
          message: `Failed to fetch organizations (${orgRes.status}). ${t}`.trim(),
        },
        { status: 400 },
      );
    }

    const orgs = await orgRes.json().catch(() => ({}));
    console.log('[Make] Organizations response for inventory:', orgs);

    // Try each organization until we find one that works
    const organizations = orgs.organizations || [];

    if (organizations.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "MAKE_NO_ORGANIZATION",
          message: `No organizations found for this token. Please make sure your token has access to an organization.`,
        },
        { status: 400 },
      );
    }

    console.log(`[Make] Found ${organizations.length} organizations for inventory, trying each...`);

    let scenariosRes: Response | null = null;
    let workingOrgId: number | string | null = null;

    for (const org of organizations) {
      console.log(`[Make] Testing organization for inventory: ${org.id} (${org.name})`);
      
      const tryRes = await fetch(`https://${region}.make.com/api/v2/scenarios?organizationId=${org.id}`, {
        method: "GET",
        headers: {
          Authorization: `Token ${secretJson.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (tryRes.ok) {
        console.log(`[Make] ✓ Organization ${org.id} (${org.name}) works for inventory!`);
        scenariosRes = tryRes;
        workingOrgId = org.id;
        break;
      } else if (tryRes.status === 403) {
        console.log(`[Make] ✗ Organization ${org.id} (${org.name}) forbids token auth for inventory, trying next...`);
        continue;
      } else {
        // Other error - might want to try next org
        const errText = await tryRes.text().catch(() => '');
        console.log(`[Make] ✗ Organization ${org.id} (${org.name}) error ${tryRes.status} for inventory: ${errText}`);
        continue;
      }
    }

    if (!scenariosRes || !workingOrgId) {
      return NextResponse.json(
        {
          ok: false,
          code: "MAKE_NO_VALID_ORGANIZATION",
          message: `None of your ${organizations.length} organizations allow token authentication. Please check your token permissions or try OAuth authentication instead.`,
        },
        { status: 400 },
      );
    }

    const finalScenariosRes = scenariosRes; // for TypeScript

    if (!finalScenariosRes.ok) {
      const t = await finalScenariosRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          code: "MAKE_SCENARIOS_FAILED",
          message: `Failed to fetch scenarios (${finalScenariosRes.status}). ${t}`.trim(),
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
      sourceId: source.id,
      inventoryEntities,
      meta: { region },
    });
  }

  // After you have created/updated the source and have sourceId available:

  return NextResponse.json({
    ok: true,
    sourceId: source.id,
    ...(platformType === "vapi" && method === "api" ? { callsLoaded: callsLoaded ?? 0 } : {}),
  });
}
