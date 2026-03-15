import { SupabaseClient } from "@supabase/supabase-js";

export type ActivityCategory =
  | "connection"
  | "portal"
  | "client"
  | "execution"
  | "access"
  | "team"
  | "settings"
  | "billing";

export type ActivityStatus = "success" | "warning" | "error" | "info";
export type ActorType = "user" | "system" | "webhook" | "cron";

export interface LogActivityParams {
  tenantId: string;
  actorId?: string | null;
  actorType?: ActorType;
  category: ActivityCategory;
  action: string;
  status?: ActivityStatus;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  clientId?: string | null;
  offeringId?: string | null;
  message: string;
  details?: Record<string, unknown> | null;
}

/**
 * Insert one activity event. Fire-and-forget — never throws.
 * Caller is responsible for providing tenantId (already validated).
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
): Promise<void> {
  try {
    const { error } = await supabase.from("activity_events").insert({
      tenant_id: params.tenantId,
      actor_id: params.actorId ?? null,
      actor_type: params.actorType ?? "user",
      category: params.category,
      action: params.action,
      status: params.status ?? "success",
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      entity_name: params.entityName ?? null,
      client_id: params.clientId ?? null,
      portal_id: params.offeringId ?? null,
      message: params.message,
      details: params.details ?? null,
    });

    if (error) {
      console.error("[logActivity] Insert failed:", error.message);
    }
  } catch (err) {
    // Fire-and-forget: never break the parent request
    console.error("[logActivity] Unexpected error:", err);
  }
}
