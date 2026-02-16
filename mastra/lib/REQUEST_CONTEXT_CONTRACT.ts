/**
 * REQUEST CONTEXT CONTRACT — Phase 5C
 * ====================================
 *
 * Authoritative reference for all RequestContext keys.
 *
 * RULE: If a value exists in RequestContext, tools MUST use it
 * via requestContextSchema + context.requestContext.all,
 * never trust LLM input parameters for identity/security values.
 *
 * Mastra's native requestContextSchema validates before execute() runs.
 * See: https://mastra.ai/docs/server/request-context
 */

import { z } from 'zod';

// ─── Reusable schemas for requestContextSchema ──────────────────────

// Use these in createTool({ requestContextSchema: ... })

/** Tools that need authenticated Supabase access */
export const AuthenticatedContextSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  supabaseAccessToken: z.string().min(1),
});

/** Extended context for tools that also need interface + platform info. */
export const InterfaceContextSchema = AuthenticatedContextSchema.extend({
  interfaceId: z.string().optional(),
  platformType: z.string().optional(),
});

/** Extended context that also carries sourceId (for event/mapping tools). */
export const SourceContextSchema = AuthenticatedContextSchema.extend({
  interfaceId: z.string().optional(),
  sourceId: z.string().optional(),
});

/** Optional context — for pure-transform tools that don't require auth
 *  but can accept tenantId for audit trail / logging. */
export const OptionalAuditContextSchema = z.object({
  tenantId: z.string().optional(),
});

/**
 * COMPLETE KEY REFERENCE
 *
 * Security keys (set by API route from Supabase Auth — NEVER trust client):
 *   tenantId              - UUID, set by API route from memberships table
 *   userId                - UUID, set by API route from auth.getUser()
 *   userRole              - 'admin'|'client'|'viewer', from memberships
 *   supabaseAccessToken   - JWT, from session.access_token
 *   userEmail             - string, from user.email
 *
 * Thread/Memory (set by API route):
 *   threadId              - string, for Mastra memory
 *   resourceId            - string (= userId), for Mastra memory
 *   journeyThreadId       - string, from client payload
 *
 * Journey Context (set by API route from client + DB):
 *   sourceId              - UUID, from journey session
 *   interfaceId           - UUID, from DB session (authoritative)
 *   platformType          - enum, from source type
 *   entityId              - UUID, from client selection
 *   workflowName          - string, from displayName
 *   skillMD               - string, platform-specific knowledge
 *
 * Phase State (set by API route, DB is authoritative):
 *   phase                 - FloweticPhase enum
 *   mode                  - alias for phase (legacy)
 *
 * User Selections (from client, validated by API route):
 *   selectedOutcome       - string
 *   selectedStyleBundleId - string (canonical bundle ID)
 *   densityPreset         - string
 *   selectedModel         - string (model selector)
 *
 * Mastra Reserved:
 *   __mastra_resource_id  - for memory system
 *   __mastra_thread_id    - for memory system
 */
