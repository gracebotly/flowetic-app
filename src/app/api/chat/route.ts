
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { RequestContext } from '@mastra/core/request-context';
import { createClient } from '@/lib/supabase/server';
import { getMastra } from '@/mastra';
import { ensureMastraThreadId } from '@/mastra/lib/ensureMastraThread';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const params = await req.json();
    
    // 1. SERVER-SIDE AUTH (CRITICAL: Never trust client data)
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const userId = session.user.id;
    
    // 2. VALIDATE TENANT MEMBERSHIP (CRITICAL: Prevent cross-tenant access)
    const clientProvidedTenantId = (params as any)?.data?.tenantId;
    
    if (!clientProvidedTenantId) {
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
    const clientJourneyThreadId = (params as any)?.data?.journeyThreadId || 'default-thread';
    
    let mastraThreadId: string;
    try {
      mastraThreadId = await ensureMastraThreadId({
        tenantId,
        journeyThreadId: clientJourneyThreadId,
        resourceId: userId,
        title: (params as any)?.data?.vibeContext?.displayName || 'Dashboard Journey',
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
    
    // SAFE: These are non-security-critical context values we can trust from client
    const clientData = (params as any)?.data ?? {};
    const safeClientKeys = [
      'platformType',
      'sourceId',
      'entityId',
      'externalId',
      'displayName',
      'phase',
      'mode',
      'selectedOutcome',
      'selectedStoryboard',
      'selectedStyleBundleId',
      'densityPreset',
      'paletteOverrideId',
      'selectedModel',
    ];
    
    for (const key of safeClientKeys) {
      if (clientData[key] !== undefined) {
        requestContext.set(key, clientData[key]);
      }
    }
    
    // 5. CALL MASTRA WITH VALIDATED CONTEXT
    const enhancedParams = {
      ...params,
      requestContext,
      // Force non-network execution in serverless: use Agent.generate() path.
      // If the handler ignores this, behavior remains unchanged.
      mode: "generate",
    };
    
    const mastra = getMastra();
    
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
    
    const stream = await handleChatStream({
      mastra,
      agentId: 'masterRouterAgent',
      params: enhancedParams,
    });
    
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

