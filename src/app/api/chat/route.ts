
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from '@mastra/core/request-context';
import { createClient } from '@/lib/supabase/server';
import { getMastraSingleton } from '@/mastra/singleton';
import { ensureMastraThreadId } from '@/mastra/lib/ensureMastraThread';
import { safeUuid } from "@/mastra/lib/safeUuid";
import { PHASE_TOOL_ALLOWLIST, type FloweticPhase } from '@/mastra/agents/instructions/phase-instructions';

export const maxDuration = 300; // Fluid Compute + Hobby = 300s max

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`TIMEOUT_${label}_${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

// ─── DETERMINISTIC PHASE ADVANCEMENT ────────────────────────────────────────
// Phase 4A from refactor guide: code-driven phase transitions, NOT LLM-driven.
// Runs AFTER each agent stream completes. Reads DB state, advances if ready.
async function autoAdvancePhase(params: {
  supabase: any;
  tenantId: string;
  journeyThreadId: string;
  mastraThreadId: string;
}): Promise<{ advanced: boolean; from?: string; to?: string }> {
  const { supabase, tenantId, journeyThreadId, mastraThreadId } = params;

  // 1. Read current session state from DB
  let session = null;
  const { data: byThread } = await supabase
    .from('journey_sessions')
    .select('id, mode, selected_entities, selected_outcome, selected_style_bundle_id, schema_ready')
    .eq('thread_id', journeyThreadId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (byThread) {
    session = byThread;
  } else {
    const { data: byMastra } = await supabase
      .from('journey_sessions')
      .select('id, mode, selected_entities, selected_outcome, selected_style_bundle_id, schema_ready')
      .eq('mastra_thread_id', mastraThreadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    session = byMastra;
  }

  if (!session) {
    console.log('[autoAdvancePhase] No session found, skipping');
    return { advanced: false };
  }

  const currentPhase = session.mode;
  let nextPhase: string | null = null;

  // 2. Deterministic transition rules
  if (currentPhase === 'select_entity' && session.selected_entities) {
    nextPhase = 'recommend';
  } else if (currentPhase === 'recommend' && session.selected_outcome) {
    nextPhase = 'style';
  } else if (
    currentPhase === 'style' &&
    session.selected_style_bundle_id &&
    session.schema_ready === true
  ) {
    nextPhase = 'build_preview';
  }

  if (!nextPhase) {
    console.log('[autoAdvancePhase] No transition needed:', {
      currentPhase,
      hasEntities: !!session.selected_entities,
      hasOutcome: !!session.selected_outcome,
      hasStyle: !!session.selected_style_bundle_id,
      schemaReady: session.schema_ready,
    });
    return { advanced: false };
  }

  // 3. Write the new phase to DB
  const { error } = await supabase
    .from('journey_sessions')
    .update({ mode: nextPhase, updated_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[autoAdvancePhase] Failed to advance:', error.message);
    return { advanced: false };
  }

  console.log('[autoAdvancePhase] ✅ Phase advanced:', {
    from: currentPhase,
    to: nextPhase,
    sessionId: session.id,
  });

  return { advanced: true, from: currentPhase, to: nextPhase };
}

export async function POST(req: Request) {
  try {
    const params = await req.json();
    
    // 1. SERVER-SIDE AUTH (CRITICAL: Never trust client data)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    
    // 2. VALIDATE TENANT MEMBERSHIP (CRITICAL: Prevent cross-tenant access)
    // AI SDK v5: params are now at top level, not nested in 'data'
    const clientData = params as any;
    const clientProvidedTenantId =
      clientData?.tenantId ??
      null;

    if (!clientProvidedTenantId || typeof clientProvidedTenantId !== 'string') {
      // AI SDK v5 transport can send auto-resubmission requests without custom body.
      // Log for visibility but keep the 400 so the frontend knows to stop retrying.
      console.warn('[api/chat] Missing tenantId — likely a transport resubmission without body context', {
        hasMessages: Array.isArray(clientData?.messages) && clientData.messages.length > 0,
        trigger: clientData?.trigger,
        keys: Object.keys(clientData || {}),
      });
      return new Response(
        JSON.stringify({ error: 'Missing tenantId in request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .eq('tenant_id', clientProvidedTenantId)
      .single();
    
    if (membershipError || !membership) {
      console.error('[api/chat] Tenant access denied:', {
        userId,
        requestedTenantId: clientProvidedTenantId,
        error: membershipError?.message,
      });
      return new Response(
        JSON.stringify({ error: 'TENANT_ACCESS_DENIED: User is not authorized for this tenant' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const tenantId = membership.tenant_id; // Use VALIDATED tenant ID, not client's
    const userRole = membership.role;
    
    // 3. GET/CREATE STABLE MASTRA THREAD
    // Validate journeyThreadId is a UUID. Reject route slugs like "vibe" or other garbage.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawJourneyThreadId = (params as any)?.journeyThreadId;
    const clientJourneyThreadId = (typeof rawJourneyThreadId === 'string' && UUID_RE.test(rawJourneyThreadId))
      ? rawJourneyThreadId
      : 'default-thread';
    if (rawJourneyThreadId && rawJourneyThreadId !== clientJourneyThreadId) {
      console.warn(`[api/chat] Rejected invalid journeyThreadId: "${rawJourneyThreadId}", using default-thread`);
    }
    
    let mastraThreadId: string;
    try {
      // Extract platform context from request for auto-session creation
      const platformType = (params as any)?.platformType ||
                           (params as any)?.vibeContext?.platformType ||
                           'other';
      const rawSourceId = (params as any)?.sourceId ||
                          (params as any)?.vibeContext?.sourceId ||
                          null;
      const sourceId = safeUuid(rawSourceId, 'sourceId') ?? rawSourceId;
      const entityId = (params as any)?.entityId ||
                       (params as any)?.vibeContext?.entityId ||
                       null;

      mastraThreadId = await ensureMastraThreadId({
        tenantId,
        journeyThreadId: clientJourneyThreadId,
        resourceId: userId,
        title: (params as any)?.displayName || 'Dashboard Journey',
        // NEW: Pass platform context for auto-session creation
        platformType,
        sourceId,
        entityId,
      });
    } catch (threadError: any) {
      console.error('[api/chat] Failed to ensure Mastra thread:', threadError);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize conversation thread' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 4. BUILD AUTHORITATIVE REQUEST CONTEXT (validated by agent/tools)
    const requestContext = new RequestContext();
    
    // CRITICAL: These are AUTHORITATIVE values from server, not client
    requestContext.set('tenantId', tenantId);
    requestContext.set('userId', userId);
    requestContext.set('userRole', userRole);
    requestContext.set('threadId', mastraThreadId);
    requestContext.set('resourceId', userId);
    requestContext.set('journeyThreadId', clientJourneyThreadId);
    
    // ✅ ADD THESE 3 LINES FOR AUTHENTICATED SUPABASE CLIENT IN TOOLS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Missing session token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    requestContext.set('supabaseAccessToken', session.access_token);
    requestContext.set('userEmail', user.email || 'unknown');
    
    // Force Mastra memory/tool operations to use validated IDs (reserved keys)
    requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
    requestContext.set(MASTRA_THREAD_ID_KEY, mastraThreadId);
    
    // SAFE: These are non-security-critical context values we can trust from client
    const safeClientKeys = [
      'platformType',
      'sourceId',
      'entityId',
      'externalId',
      'displayName',
      'phase',
      'mode',
      'selectedOutcome',
      // 'selectedStoryboard' removed — storyboard/align phase eliminated
      'selectedStyleBundleId',
      'densityPreset',
      'paletteOverrideId',
      'selectedModel',
    ];

    // Map displayName to workflowName for agent instructions
    const workflowName = clientData.displayName || clientData.externalId;
    if (workflowName) {
      requestContext.set('workflowName', String(workflowName));
    }

    // Also preserve skillMD for platform-specific knowledge
    if (clientData.skillMD) {
      requestContext.set('skillMD', clientData.skillMD);
    }

    for (const key of safeClientKeys) {
      if (clientData[key] !== undefined) {
        requestContext.set(key, clientData[key]);
      }
    }

    // FIX: Override client-provided phase with authoritative DB value.
    // Client React state can become stale if advancePhase streams back
    // but the client doesn't update journeyMode before the next request.
    // BUG FIX: Query BOTH thread_id AND mastra_thread_id columns since advancePhase
    // may write to either depending on which ID was available.
    // Extract clean UUIDs from potentially compound IDs (e.g., "sourceId:externalId")
    const cleanJourneyThreadId = safeUuid(clientJourneyThreadId, 'journeyThreadId') ?? clientJourneyThreadId;
    const cleanMastraThreadId = safeUuid(mastraThreadId, 'mastraThreadId') ?? mastraThreadId;
    if (cleanJourneyThreadId && cleanJourneyThreadId !== 'default-thread') {
      try {
        // Query by thread_id first (primary), then fallback to mastra_thread_id
        let sessionRow = null;

        const { data: byThreadId } = await supabase
          .from('journey_sessions')
          .select('id, mode, preview_interface_id, selected_style_bundle_id, selected_entities, selected_outcome, schema_ready')
          .eq('thread_id', cleanJourneyThreadId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (byThreadId) {
          sessionRow = byThreadId;
        } else {
          // Fallback: query by mastra_thread_id (in case thread was created that way)
          const { data: byMastraId } = await supabase
            .from('journey_sessions')
            .select('id, mode, preview_interface_id, selected_style_bundle_id, selected_entities, selected_outcome, schema_ready')
            .eq('mastra_thread_id', cleanMastraThreadId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          sessionRow = byMastraId;
        }
        const VALID_PHASES = ['select_entity', 'recommend', 'style', 'build_preview', 'interactive_edit', 'deploy'] as const;

        if (sessionRow?.mode) {
          if (VALID_PHASES.includes(sessionRow.mode as any)) {
            requestContext.set('phase', sessionRow.mode);
            console.log('[api/chat] Phase from DB:', {
              clientPhase: clientData.phase,
              dbPhase: sessionRow.mode,
              overridden: clientData.phase !== sessionRow.mode,
              sessionId: sessionRow.id,
              threadId: clientJourneyThreadId,
            });
          } else {
            // Bad data in DB — don't let it crash the agent
            console.warn('[api/chat] Invalid phase in DB, falling back to select_entity:', {
              invalidPhase: sessionRow.mode,
              sessionId: sessionRow.id,
              threadId: clientJourneyThreadId,
            });
            requestContext.set('phase', 'select_entity');
          }
        } else {
          // Log when no session found - helps debug why phase might be wrong
          console.log('[api/chat] No session found for phase lookup:', {
            clientPhase: clientData.phase,
            threadId: clientJourneyThreadId,
            mastraThreadId,
          });
        }

        // Load entity selections from DB into RequestContext
        if (sessionRow?.selected_entities) {
          requestContext.set('selectedEntities', sessionRow.selected_entities);
          console.log('[api/chat] Loaded selectedEntities from DB:', sessionRow.selected_entities);
        }
        // Load selected outcome from DB into RequestContext
        if (sessionRow?.selected_outcome) {
          requestContext.set('selectedOutcome', sessionRow.selected_outcome);
          console.log('[api/chat] Loaded selectedOutcome from DB:', sessionRow.selected_outcome);
        }
        // Load schema_ready from DB into RequestContext
        if (sessionRow?.schema_ready) {
          requestContext.set('schemaReady', String(sessionRow.schema_ready));
        }

        // BUG FIX: Override client-provided selectedStyleBundleId with DB value.
        // Client React state can become stale due to batched setState + closure capture.
        // The DB value (written by advancePhase tool) is authoritative.
        if (sessionRow?.selected_style_bundle_id) {
          const clientStyle = requestContext.get('selectedStyleBundleId') as string | undefined;
          requestContext.set('selectedStyleBundleId', sessionRow.selected_style_bundle_id);
          if (clientStyle !== sessionRow.selected_style_bundle_id) {
            console.log('[api/chat] Style override from DB:', {
              clientStyle,
              dbStyle: sessionRow.selected_style_bundle_id,
              sessionId: sessionRow.id,
            });
          }
        }

        // BUG FIX: Ensure interface exists for this journey session
        // This prevents "MISSING" interfaceId in downstream tools
        if (sessionRow && !sessionRow.preview_interface_id) {
          const { data: newInterface, error: ifaceErr } = await supabase
            .from('interfaces')
            .insert({
              tenant_id: tenantId,
              name: clientData.displayName || 'Untitled Dashboard',
              status: 'draft',
              component_pack: 'default',
            })
            .select('id')
            .single();
          if (!ifaceErr && newInterface?.id) {
            await supabase
              .from('journey_sessions')
              .update({
                preview_interface_id: newInterface.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionRow.id);
            requestContext.set('interfaceId', newInterface.id);
            console.log('[api/chat] Created interface for session:', {
              sessionId: sessionRow.id,
              interfaceId: newInterface.id,
            });
          }
        } else if (sessionRow?.preview_interface_id) {
          requestContext.set('interfaceId', sessionRow.preview_interface_id);
        }
      } catch (phaseErr) {
        // Non-fatal: if DB read fails, client-provided phase is used as fallback
        console.warn('[api/chat] Failed to read phase from DB, using client value:', phaseErr);
      }
    }

    const mastra = getMastraSingleton();

    if (process.env.DEBUG_CHAT_ROUTE === 'true') {
      console.log('[api/chat] Authorized request:', {
        tenantId,
        userId,
        userRole,
        mastraThreadId,
        clientJourneyThreadId,
        messagesCount: Array.isArray((params as any)?.messages) ? (params as any).messages.length : 0,
      });
    }

    // PHASE VERIFICATION: Log final phase value before agent execution
    const finalPhase = requestContext.get('phase') as string;
    console.log('[api/chat] Final RequestContext phase before agent:', {
      phase: finalPhase,
      tenantId: tenantId.substring(0, 8) + '...',
      threadId: mastraThreadId.substring(0, 8) + '...',
    });

    // 5. CALL MASTRA WITH VALIDATED CONTEXT
    const enhancedParams = {
      ...params,
      requestContext,
      mode: "generate",
    };

    if (process.env.DEBUG_CHAT_ROUTE === 'true') {
      console.log('[api/chat] Authorized request:', {
        tenantId, userId, userRole, mastraThreadId,
        clientJourneyThreadId,
        messagesCount: Array.isArray((params as any)?.messages)
          ? (params as any).messages.length : 0,
      });
    }

    // PHASE GATE: Compute activeTools based on authoritative DB phase.
    // This uses the AI SDK's official mechanism to physically remove tool
    // schemas from the LLM context. The model CANNOT call tools not in
    // this list — unlike instruction-based guards which the LLM can bypass
    // via tool-error recovery (see AI SDK docs: tool-error content parts
    // are fed back to the model, allowing it to try alternative tools).
    const phaseForToolGate = (requestContext.get('phase') as FloweticPhase) || 'select_entity';
    const allowedTools = PHASE_TOOL_ALLOWLIST[phaseForToolGate] || PHASE_TOOL_ALLOWLIST.select_entity;

    console.log('[api/chat] Phase tool gate:', {
      phase: phaseForToolGate,
      allowedToolCount: allowedTools.length,
      allowedTools,
    });

    const stream = await withTimeout(
      handleChatStream({
        mastra,
        agentId: 'masterRouterAgent',
        params: enhancedParams,
        sendStart: false,
        sendFinish: true,
        sendReasoning: true,
        sendSources: false,
        defaultOptions: {
          toolCallConcurrency: 1,
          maxSteps: 15,
          toolChoice: "auto",
          activeTools: allowedTools,
          onFinish: async () => {
            // PHASE 4A: Deterministic phase advancement after stream completes
            // This runs AFTER the agent is done generating. It checks what data
            // was persisted to DB during the stream and advances the phase if ready.
            try {
              if (cleanJourneyThreadId && cleanJourneyThreadId !== 'default-thread') {
                const result = await autoAdvancePhase({
                  supabase,
                  tenantId,
                  journeyThreadId: cleanJourneyThreadId,
                  mastraThreadId: cleanMastraThreadId,
                });
                if (result.advanced) {
                  console.log('[api/chat] onFinish auto-advanced phase:', result);
                }
              }
            } catch (err) {
              // Non-fatal: log but don't crash the stream response
              console.warn('[api/chat] onFinish autoAdvancePhase error:', err);
            }
          },
        },
      }),
      290000,
      "api_chat_stream"
    );

    return createUIMessageStreamResponse({ stream });
    
  } catch (error: any) {
    console.error('[api/chat] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

