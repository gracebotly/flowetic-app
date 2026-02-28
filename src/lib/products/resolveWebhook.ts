// ============================================================================
// Level 4: Webhook URL Resolver
// Resolves webhook URL from source credentials at runtime.
// SECURITY: This runs SERVER-SIDE ONLY. Client NEVER sees webhook URLs.
// ============================================================================

import { decryptSecret } from "@/lib/secrets";

interface ResolvedWebhook {
  url: string;
  headers: Record<string, string>;
  method: "POST" | "GET";
}

/**
 * Resolve the webhook URL for a product's underlying workflow.
 *
 * For Make: uses the scenario's trigger webhook URL (stored during import).
 * For n8n: constructs from instance_url + webhook_path or stored URL.
 *
 * @param platform - "make" or "n8n"
 * @param secretHash - Encrypted secret_hash from sources table
 * @param entityMetadata - Optional metadata from source_entities (may contain webhook paths)
 * @returns Resolved webhook URL and headers
 */
export function resolveWebhookUrl(
  platform: "make" | "n8n",
  secretHash: string,
  entityMetadata?: Record<string, unknown> | null,
): ResolvedWebhook {
  if (!secretHash) {
    throw new Error("WEBHOOK_RESOLVE_FAILED: No encrypted credentials found for this source.");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(decryptSecret(secretHash));
  } catch {
    throw new Error("WEBHOOK_RESOLVE_FAILED: Unable to decrypt source credentials.");
  }

  if (platform === "make") {
    return resolveMakeWebhook(credentials, entityMetadata);
  }

  if (platform === "n8n") {
    return resolveN8nWebhook(credentials, entityMetadata);
  }

  throw new Error(`WEBHOOK_RESOLVE_FAILED: Unsupported platform "${platform}"`);
}

function resolveMakeWebhook(
  credentials: Record<string, unknown>,
  entityMetadata?: Record<string, unknown> | null,
): ResolvedWebhook {
  // Priority 1: Explicit webhook URL in entity metadata (set during import)
  const entityWebhookUrl = entityMetadata?.webhookUrl as string | undefined;
  if (entityWebhookUrl && typeof entityWebhookUrl === "string") {
    return {
      url: entityWebhookUrl,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    };
  }

  // Priority 2: Webhook URL stored in credentials during connection
  const storedWebhook = credentials.webhookUrl as string | undefined;
  if (storedWebhook && typeof storedWebhook === "string") {
    return {
      url: storedWebhook,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    };
  }

  throw new Error(
    "WEBHOOK_RESOLVE_FAILED: No webhook URL found for Make scenario. " +
    "Ensure the scenario has a Webhook trigger module and was imported correctly.",
  );
}

function resolveN8nWebhook(
  credentials: Record<string, unknown>,
  entityMetadata?: Record<string, unknown> | null,
): ResolvedWebhook {
  const instanceUrl = (credentials.instanceUrl as string | undefined)?.replace(/\/+$/, "");
  const apiKey = credentials.apiKey as string | undefined;

  // Priority 1: Explicit webhook URL in entity metadata
  const entityWebhookUrl = entityMetadata?.webhookUrl as string | undefined;
  if (entityWebhookUrl && typeof entityWebhookUrl === "string") {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    return { url: entityWebhookUrl, headers, method: "POST" };
  }

  // Priority 2: Webhook path in entity metadata + instance URL
  const webhookPath = entityMetadata?.webhookPath as string | undefined;
  if (webhookPath && instanceUrl) {
    const cleanPath = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`;
    const url = `${instanceUrl}/webhook${cleanPath}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // n8n webhook auth: if the webhook requires header auth, include API key
    if (apiKey) {
      headers["X-N8N-API-KEY"] = apiKey;
    }
    return { url, headers, method: "POST" };
  }

  // Priority 3: Stored webhook URL in credentials
  const storedWebhook = credentials.webhookUrl as string | undefined;
  if (storedWebhook && typeof storedWebhook === "string") {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["X-N8N-API-KEY"] = apiKey;
    }
    return { url: storedWebhook, headers, method: "POST" };
  }

  throw new Error(
    "WEBHOOK_RESOLVE_FAILED: No webhook URL found for n8n workflow. " +
    "Ensure the workflow has a Webhook trigger node and was imported correctly.",
  );
}
