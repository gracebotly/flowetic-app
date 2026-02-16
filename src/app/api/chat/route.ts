import { convertToModelMessages, Message } from 'ai';
import { NextRequest } from 'next/server';
import { mastra } from '@/mastra';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      requestContext: clientContext,
    }: { messages: Message[]; requestContext?: Record<string, unknown> } = await req.json();

    // Extract IDs from requestContext
    const tenantId = clientContext?.tenantId as string | undefined;
    const mastraThreadId = clientContext?.mastraThreadId as string | undefined;
    const journeyThreadId = clientContext?.journeyThreadId as string | undefined;

    if (!tenantId || !mastraThreadId || !journeyThreadId) {
      return new Response('Missing required context', { status: 400 });
    }

    // Get agent
    const agent = mastra.getAgent('vibeJourneyCoach');
    if (!agent) {
      return new Response('Agent not found', { status: 500 });
    }

    // Convert messages and stream
    const modelMessages = convertToModelMessages(messages);
    const result = await agent.stream(modelMessages, {
      requestContext: clientContext as Record<string, unknown>,
    });

    // Return streaming response with onFinish callback for phase transitions
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async () => {
        // Phase transitions happen here after stream completes
        try {
          await checkAndAdvancePhase({
            requestContext: clientContext as Record<string, unknown>,
            tenantId,
            mastraThreadId,
            journeyThreadId,
          });
        } catch (error) {
          console.error('[Phase4] Auto-advance failed:', error);
          // Don't throw - phase advancement is non-critical
        }
      },
    });
  } catch (error) {
    console.error('[API] Chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Check and automatically advance phase based on data availability
 */
async function checkAndAdvancePhase(params: {
  requestContext: Record<string, unknown>;
  tenantId: string;
  mastraThreadId: string;
  journeyThreadId: string;
}) {
  const { requestContext, tenantId, mastraThreadId, journeyThreadId } = params;

  const supabase = mastra.getStorage()?.client;
  if (!supabase) {
    console.warn('[Phase4] No Supabase client available');
    return;
  }

  // Get current journey session
  const { data: session, error: sessionError } = await supabase
    .from('journey_sessions')
    .select('mode, selected_outcome, selected_style_bundle_id, schema_ready')
    .eq('id', journeyThreadId)
    .eq('tenant_id', tenantId)
    .single();

  if (sessionError || !session) {
    console.error('[Phase4] Failed to fetch journey session:', sessionError);
    return;
  }

  const currentMode = session.mode;
  console.log(`[Phase4] Current mode: ${currentMode}`);

  // Define transition rules
  let newMode: string | null = null;

  switch (currentMode) {
    case 'select_entity': {
      // Check RequestContext for selectedEntities (array) or selectedEntity (singular)
      const selectedEntities = requestContext.selectedEntities;
      const selectedEntity = requestContext.selectedEntity;

      if (selectedEntities || selectedEntity) {
        newMode = 'recommend';
        console.log('[Phase4] Entity selected, advancing to recommend');
      }
      break;
    }

    case 'recommend': {
      // Check RequestContext first, fallback to DB
      const contextOutcome = requestContext.selectedOutcome;
      const dbOutcome = session.selected_outcome;

      if (contextOutcome || dbOutcome) {
        newMode = 'style';
        console.log('[Phase4] Outcome selected, advancing to style');
      }
      break;
    }

    case 'style': {
      // Check RequestContext first, fallback to DB
      const contextStyleId = requestContext.selectedStyleBundleId;
      const dbStyleId = session.selected_style_bundle_id;

      // CRITICAL: Must also check schema_ready from DB
      const schemaReady = session.schema_ready;

      if ((contextStyleId || dbStyleId) && schemaReady === true) {
        newMode = 'build_preview';
        console.log('[Phase4] Style selected AND schema ready, advancing to build_preview');
      } else if ((contextStyleId || dbStyleId) && !schemaReady) {
        console.log('[Phase4] Style selected but schema NOT ready, cannot advance to build_preview');
      }
      break;
    }

    default:
      console.log(`[Phase4] No auto-advance rule for mode: ${currentMode}`);
  }

  // Execute phase transition if needed
  if (newMode) {
    const { error: updateError } = await supabase
      .from('journey_sessions')
      .update({ mode: newMode })
      .eq('id', journeyThreadId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[Phase4] Failed to update mode:', updateError);
    } else {
      console.log(`[Phase4] ✅ Auto-advanced: ${currentMode} → ${newMode}`);
    }
  }
}
