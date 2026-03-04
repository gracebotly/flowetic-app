import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { decryptSecret } from "@/lib/secrets";
import { extractInputSchema } from "@/lib/products/extractInputSchema";

export const runtime = "nodejs";

type Secret = Record<string, unknown>;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function normalizeBaseUrl(instanceUrl?: string | null) {
  if (!instanceUrl) return null;
  try {
    return new URL(instanceUrl).origin;
  } catch {
    return null;
  }
}

function getString(secret: Secret, key: string): string | null {
  const value = secret[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entityId } = await params;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json(401, { error: "Unauthorized" });

    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!membership) return json(403, { error: "No tenant" });

    const tenantId = membership.tenant_id;

    const { data: entity, error: entityErr } = await supabase
      .from("source_entities")
      .select("id, source_id, external_id, entity_kind, display_name")
      .eq("id", entityId)
      .eq("tenant_id", tenantId)
      .single();

    if (entityErr || !entity) {
      return json(404, { error: "Entity not found" });
    }

    const { data: source, error: sourceErr } = await supabase
      .from("sources")
      .select("id, type, secret_hash")
      .eq("id", entity.source_id)
      .eq("tenant_id", tenantId)
      .single();

    if (sourceErr || !source) {
      return json(404, { error: "Source not found" });
    }

    if (!source.secret_hash) {
      return json(400, { error: "Source has no credentials configured" });
    }

    let secret: Secret;
    try {
      const parsed = JSON.parse(decryptSecret(source.secret_hash));
      secret = typeof parsed === "object" && parsed !== null ? (parsed as Secret) : {};
    } catch {
      return json(500, { error: "Failed to decrypt source credentials" });
    }

    let rawEntityData: Record<string, unknown> | null = null;
    const platformType = source.type;

    if (platformType === "n8n") {
      const baseUrl =
        normalizeBaseUrl(getString(secret, "instanceUrl")) ??
        process.env.N8N_DEFAULT_BASE_URL ??
        null;
      const apiKey = getString(secret, "apiKey");

      if (!baseUrl || !apiKey) {
        return json(400, {
          error: "n8n credentials incomplete (need apiKey + instanceUrl)",
        });
      }

      const headers: Record<string, string> = {};
      if ((getString(secret, "authMode") ?? "bearer") === "header") {
        headers["X-N8N-API-KEY"] = apiKey;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${baseUrl}/api/v1/workflows/${entity.external_id}`, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        return json(502, { error: `n8n API returned ${res.status}` });
      }

      rawEntityData = (await res.json()) as Record<string, unknown>;
    } else if (platformType === "make") {
      const accessToken = getString(secret, "accessToken");
      if (!accessToken) {
        return json(400, { error: "Make credentials incomplete (need accessToken)" });
      }

      const makeBaseUrl = getString(secret, "baseUrl") || "https://us1.make.com";
      const res = await fetch(
        `${makeBaseUrl}/api/v2/scenarios/${entity.external_id}/blueprint`,
        {
          method: "GET",
          headers: {
            Authorization: `Token ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        return json(502, { error: `Make API returned ${res.status}` });
      }

      const data = (await res.json()) as { response?: Record<string, unknown> } & Record<string, unknown>;
      rawEntityData = data.response || data;
    } else if (platformType === "vapi") {
      const apiKey = getString(secret, "apiKey");
      if (!apiKey) {
        return json(400, { error: "Vapi credentials incomplete" });
      }

      const res = await fetch(`https://api.vapi.ai/assistant/${entity.external_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        return json(502, { error: `Vapi API returned ${res.status}` });
      }

      rawEntityData = (await res.json()) as Record<string, unknown>;
    } else if (platformType === "retell") {
      const apiKey = getString(secret, "apiKey");
      if (!apiKey) {
        return json(400, { error: "Retell credentials incomplete" });
      }

      const res = await fetch(`https://api.retellai.com/get-agent/${entity.external_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        return json(502, { error: `Retell API returned ${res.status}` });
      }

      rawEntityData = (await res.json()) as Record<string, unknown>;
    } else {
      return json(400, { error: `Unsupported platform: ${platformType}` });
    }

    const inputSchema = extractInputSchema(platformType, rawEntityData ?? {});

    return json(200, {
      ok: true,
      entityId: entity.id,
      entityName: entity.display_name,
      platformType,
      inputSchema,
      fieldCount: inputSchema.length,
    });
  } catch (error: unknown) {
    console.error("[entities/schema] Error:", error);
    return json(500, { error: "Failed to extract schema" });
  }
}
