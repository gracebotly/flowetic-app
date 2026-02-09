
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { toAISdkStream } from '@mastra/ai-sdk';
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from '@mastra/core/request-context';
import { createClient } from '@/lib/supabase/server';
import { getMastraSingleton } from '@/mastra/singleton';
import { ensureMastraThreadId } from '@/mastra/lib/ensureMastraThread';

export const maxDuration = 300; // Fluid Compute + Hobby = 300s max

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`TIMEOUT_${label}_${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
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
    const clientJourneyThreadId = (params as any)?.journeyThreadId || 'default-thread';
    
    let mastraThreadId: string;
    try {
      mastraThreadId = await ensureMastraThreadId({
        tenantId,
        journeyThreadId: clientJourneyThreadId,
        resourceId: userId,
        title: (params as any)?.displayName || 'Dashboard Journey',
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

    // =========================================================================
    // SERVER-SIDE PHASE ADVANCEMENT
    // Detect user selections in the latest message and advance phase
    // before constructing requestContext for the agent.
    // =========================================================================
    const latestUserMessage = Array.isArray((params as any)?.messages)
      ? [...(params as any).messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
      : '';
    const msgLower = typeof latestUserMessage === 'string' ? latestUserMessage.toLowerCase() : '';
    
    let currentPhase = (requestContext.get('phase') as string) || 'select_entity';
    
    // Phase: select_entity → recommend (user selected entities / workflow parts)
    if (currentPhase === 'select_entity' && (
      msgLower.includes('__action__select_entity') ||
      msgLower.includes('track') ||
      msgLower.includes('selected') ||
      msgLower.includes('these') ||
      msgLower.includes('all of them') ||
      msgLower.includes('yes')
    )) {
      currentPhase = 'recommend';
      requestContext.set('phase', 'recommend');
      if (process.env.DEBUG_CHAT_ROUTE === 'true') {
        console.log('[api/chat] Phase advanced: select_entity → recommend');
      }
    }
    
    // Phase: recommend → style (user selected outcome like "dashboard" or "product")
    if (currentPhase === 'recommend' && (
      msgLower.includes('__action__select_outcome') ||
      msgLower.includes('dashboard') ||
      msgLower.includes('product') ||
      msgLower.includes('monitoring') ||
      msgLower.includes('analytics')
    )) {
      currentPhase = 'style';
      requestContext.set('phase', 'style');
      // Also capture the outcome
      if (msgLower.includes('dashboard') || msgLower.includes('monitoring') || msgLower.includes('analytics')) {
        requestContext.set('selectedOutcome', 'dashboard');
      } else if (msgLower.includes('product')) {
        requestContext.set('selectedOutcome', 'product');
      }
      if (process.env.DEBUG_CHAT_ROUTE === 'true') {
        console.log('[api/chat] Phase advanced: recommend → style');
      }
    }
    
    // Phase: style → build_preview (user selected a style bundle)
    if (currentPhase === 'style' && (
      msgLower.includes('__action__select_style') ||
      msgLower.includes('minimal') ||
      msgLower.includes('bold') ||
      msgLower.includes('corporate') ||
      msgLower.includes('style') ||
      msgLower.includes('clean') ||
      msgLower.includes('dark') ||
      msgLower.includes('light')
    )) {
      currentPhase = 'build_preview';
      requestContext.set('phase', 'build_preview');
      if (process.env.DEBUG_CHAT_ROUTE === 'true') {
        console.log('[api/chat] Phase advanced: style → build_preview');
      }
    }

    // =========================================================================
    // AGENT NETWORK EXECUTION
    // Use agent.network() for proper multi-agent orchestration.
    // This handles sub-agent delegation at the framework level,
    // eliminating maxSteps/resourceId construction errors.
    // =========================================================================
    const master = mastra.getAgent('masterRouterAgent');
    if (!master) {
      return new Response(
        JSON.stringify({ error: 'masterRouterAgent not registered' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const messages = (params as any)?.messages ?? [];

    const networkStream = await withTimeout(
      master.network(messages, {
        maxSteps: 10,
        memory: {
          thread: mastraThreadId,
          resource: userId,
        },
        requestContext,
      }),
      290000,
      'api_chat_network',
    );

    // Convert network stream → AI SDK UI stream
    const uiMessageStream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        for await (const part of toAISdkStream(networkStream, {
          from: 'network',
        })) {
          await writer.write(part);
        }
      },
    });

    return createUIMessageStreamResponse({
      stream: uiMessageStream,
    });
    
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

