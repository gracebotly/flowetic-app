
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/secrets";
import { validateMcpServer } from "@/lib/mcp/validateMcpServer";

export const runtime = "nodejs";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";

const MAKE_REGIONS = ["us1", "eu1", "us2", "eu2"] as const;
type MakeRegion = (typeof MAKE_REGIONS)[number];

type ConnectWarning = { code: string; message: string };
type ConnectErrorDetails = {
  platformType?: string;
  method?: string;
  region?: string | null;
  providerStatus?: number;
  providerBodySnippet?: string;
};

function safeSnippet(input: string, maxLen = 300) {
  const s = (input || "").replace(/\s+/g, " ").trim();
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

function providerAuthMessage(args: {
  platform: "n8n" | "make" | "vapi" | "retell";
  status: number;
  fallback: string;
}): string {
  const { platform, status, fallback } = args;

  if (status === 401) {
    if (platform === "n8n") return "n8n rejected these credentials (401). Check your API key and auth mode.";
    if (platform === "vapi") return "Vapi rejected this API key (401). Please regenerate your Vapi Private API Key and try again.";
    if (platform === "retell") return "Retell rejected this API key (401). Please regenerate your Retell API Key and try again.";
    if (platform === "make") return "Make rejected this API token (401). Please regenerate your token and try again.";
  }

  if (status === 403) {
    if (platform === "make") {
      return "Make forbids API token authorization for this organization. You likely need a paid Make plan and/or org settings that allow token auth.";
    }
    return `${platform} returned Forbidden (403). Please verify your account permissions.`;
  }

  if (status === 404) {
    return `${platform} API endpoint not found (404). This is likely a backend configuration issue.`;
  }

  if (status === 429) {
    return `${platform} rate limited the request (429). Please wait a moment and try again.`;
  }

  if (status >= 500) {
    return `${platform} is having issues (${status}). Please try again in a moment.`;
  }

  return fallback;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: ConnectErrorDetails,
) {
  return NextResponse.json({ ok: false, code, message, details }, { status });
}

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
    return errorResponse(401, "AUTH_REQUIRED", "Authentication required.");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return errorResponse(403, "TENANT_ACCESS_DENIED", "Tenant access denied.");
  }

  const body = (await req.json().catch(() => ({}))) as any;

  const platformType = body.platformType as PlatformType | undefined;
  const connectionName = (body.name as string | undefined) ?? "";
  const method = (body.method as "api" | "webhook" | "mcp" | undefined) ?? "api";
  const region = (body.region as string | undefined) ?? undefined;
  
  // Support both apiToken (legacy) and apiKey (new frontend) parameter names
  const apiToken = body.apiToken || body.apiKey;

  // Debug logging for troubleshooting
  console.log('[Connections Connect Debug]', {
    platformType,
    hasToken: !!apiToken,
    tokenLength: apiToken?.length,
    method,
    region,
    bodyKeys: Object.keys(body),
    fullBody: body
  });

  if (!platformType) {
    return errorResponse(400, "MISSING_PLATFORM_TYPE", "Platform type is required.");
  }

  // Enforce Make API-only - webhook connections are no longer supported
  if (platformType === "make" && method !== "api") {
    return errorResponse(
      400,
      "MAKE_API_ONLY",
      "Make connections require API method. Webhook connections are not supported.",
    );
  }

  const methodStatus =
    method === "webhook" ? "method:webhook" : method === "mcp" ? "method:mcp" : "method:api";

  const warnings: ConnectWarning[] = [];
  let inventoryEntities: Array<{ entityKind: string; externalId: string; displayName: string }> | null = null;

  // Credentials payload to encrypt into sources.secret_hash
  // NOTE: we store a JSON string inside the encrypted envelope.
  let secretJson: any = { method, platformType };

  if (method === "api") {
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;

    if (!apiToken) {
      return errorResponse(400, "MISSING_API_KEY", "API key is required.");
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
          return errorResponse(
            400,
            "MAKE_INVALID_TOKEN",
            `Failed to connect to ${region.toUpperCase()} region. Check your API token has scenarios:read permission and correct region selected.`,
            {
              platformType,
              method,
              region: region ?? null,
            }
          );
        }
        makeRegion = region;
      } else {
        // Fallback to auto-detection (legacy support)
        console.log(`[Make] No valid region provided, falling back to auto-detection`);
        const detectedRegion = await detectMakeRegion(apiToken);
        if (!detectedRegion) {
          return errorResponse(
            400,
            "MAKE_REGION_DETECTION_FAILED",
            "Could not detect Make.com region. Please select your region manually.",
            {
              platformType,
              method,
              region: region ?? null,
            }
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
      return errorResponse(400, "MISSING_MCP_URL", "MCP URL is required.");
    }

    const validation = await validateMcpServer({
      serverId: `${platformType}-mcp`,
      url: mcpUrl,
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });

    if (!validation.ok) {
      return errorResponse(400, "MCP_VALIDATION_FAILED", validation.error || "MCP validation failed");
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
      const msg = providerAuthMessage({
        platform: "n8n",
        status: testRes.status,
        fallback: `n8n API auth failed (${testRes.status}). ${t}`.trim(),
      });

      return errorResponse(
        400,
        "N8N_API_FAILED",
        msg,
        {
          platformType,
          method,
          providerStatus: testRes.status,
          providerBodySnippet: safeSnippet(t),
        },
      );
    }
  }

  if (platformType === "vapi" && method === "api") {
    const key = String(secretJson?.apiKey || "").trim();
    if (!key) {
      return errorResponse(400, "MISSING_API_KEY", "Vapi Private API Key is required.");
    }

    const testRes = await fetch("https://api.vapi.ai/v1/assistants", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    const t = await testRes.text().catch(() => "");
    if (!testRes.ok) {
      const msg = providerAuthMessage({
        platform: "vapi",
        status: testRes.status,
        fallback: "Unable to validate your Vapi API key. Please check your key and try again.",
      });

      return errorResponse(400, "VAPI_AUTH_FAILED", msg, {
        platformType,
        method,
        providerStatus: testRes.status,
        providerBodySnippet: safeSnippet(t),
      });
    }

    // Parse assistants for inventory list
    let parsed: any = null;
    try {
      parsed = t ? JSON.parse(t) : null;
    } catch {
      parsed = null;
    }

    const assistants = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.assistants)
        ? parsed.assistants
        : [];

    inventoryEntities = assistants.map((a: any) => ({
      entityKind: "assistant",
      externalId: String(a?.id ?? ""),
      displayName: String(a?.name ?? `Assistant ${String(a?.id ?? "")}`),
    })).filter((x: any) => x.externalId);
  }

  if (platformType === "retell" && method === "api") {
    const key = String(secretJson?.apiKey || "").trim();
    if (!key) {
      return errorResponse(400, "MISSING_API_KEY", "Retell API Key is required.");
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
      const msg = providerAuthMessage({
        platform: "retell",
        status: testRes.status,
        fallback: "Unable to validate your Retell API key. Please check your key and try again.",
      });

      return errorResponse(
        400,
        "RETELL_AUTH_FAILED",
        msg,
        {
          platformType,
          method,
          providerStatus: testRes.status,
          providerBodySnippet: safeSnippet(t),
        },
      );
    }

    // Parse agents for inventory list
    const testText = await testRes.text().catch(() => "");
    let parsed: any = null;
    try {
      parsed = testText ? JSON.parse(testText) : null;
    } catch {
      parsed = null;
    }

    const agents = Array.isArray(parsed?.agents) ? parsed.agents : Array.isArray(parsed) ? parsed : [];
    inventoryEntities = agents
      .map((a: any) => ({
        entityKind: "agent",
        externalId: String(a?.agent_id ?? a?.id ?? ""),
        displayName: String(a?.agent_name ?? a?.name ?? `Agent ${String(a?.agent_id ?? a?.id ?? "")}`),
      }))
      .filter((x: any) => x.externalId);

    // Pull agents count for Retell
    try {
      const agentsRes = await fetch("https://api.retellai.com/list-agents", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      });

      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json().catch(() => null);
        const agents = Array.isArray(agentsJson?.agents) ? agentsJson.agents : Array.isArray(agentsJson) ? agentsJson : [];
        if (agents.length === 0) {
          warnings.push({
            code: "RETELL_NO_AGENTS",
            message:
              "Retell account has no agents. New accounts may take up to 15 minutes after first call for agents to appear in API.",
          });
        }
      }
    } catch {
      // Silently ignore agent loading errors; not critical for connection
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

    // Warning for no historical calls
    if (callsLoaded === 0) {
      warnings.push({
        code: "VAPI_NO_HISTORICAL_CALLS",
        message:
          "This API key appears to have no historical calls. Make sure it belongs to your production organization, not a personal dev org.",
      });
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
    return errorResponse(400, "PERSISTENCE_FAILED", error.message);
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
      return errorResponse(
        400,
        "MAKE_NO_VALID_ORGANIZATION",
        `None of your ${organizations.length} organizations allow token authentication. Please check your token permissions or try OAuth authentication instead.`,
        {
          platformType,
          method,
          region: region ?? null,
        }
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
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  }

  // After you have created/updated the source and have sourceId available:

  return NextResponse.json({
    ok: true,
    sourceId: source.id,
    ...(inventoryEntities ? { inventoryEntities } : {}),
    ...(platformType === "vapi" && method === "api" ? { callsLoaded: callsLoaded ?? 0 } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
