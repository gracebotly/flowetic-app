import { mastra } from '@/mastra';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, threadId, tenantId, userId, sourceId, platformType } = body;
    
    // Get last user message
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // Simple intent detection
    const shouldGeneratePreview =
      lastMessage.toLowerCase().includes('generate') ||
      lastMessage.toLowerCase().includes('create') ||
      lastMessage.toLowerCase().includes('build');
    
    if (shouldGeneratePreview && sourceId && platformType) {
      // Set runtime context before executing workflow
      const workflow = mastra.getWorkflow('generatePreview');
      const run = await workflow.createRunAsync();
      
      // Set runtime context values
      run.runtimeContext.set('tenantId', tenantId);
      run.runtimeContext.set('userId', userId);
      run.runtimeContext.set('sourceId', sourceId);
      run.runtimeContext.set('platformType', platformType);
      
      // Execute workflow with proper input structure
      const result = await run.start({
        inputData: {
          tenantId,
          userId,
          userRole: 'admin', // This should come from request body
          interfaceId,
          instructions: lastMessage, // Pass last message as instructions
        },
      });
      
      // Return structured result
      return new Response(
        JSON.stringify({
          type: 'workflow_complete',
          workflow: 'generate-preview',
          result: {
            previewUrl: result.results?.finalize?.previewUrl,
            interfaceId: result.results?.finalize?.interfaceId,
            versionId: result.results?.finalize?.previewVersionId,
          },
          message: `✅ Dashboard preview generated! You can view it at ${result.results?.finalize?.previewUrl}`,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Fall back to conversational agent
    const agent = mastra.agents.masterRouter;
    const response = await agent.generate(lastMessage, {
      maxSteps: 3,
    });
    
    return new Response(
      response.text,
      {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  } catch (error: any) {
    console.error('Master Agent Error:', error);
    
    // Handle known errors
    if (error.message === 'NO_EVENTS_AVAILABLE') {
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'NO_EVENTS_AVAILABLE',
          message: 'No events found. Please connect your platform and ensure data is flowing.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (error.message === 'MAPPING_INCOMPLETE_REQUIRED_FIELDS') {
      return new Response(
        JSON.stringify({
          executionContext: {
            tenantId,
            userId,
            sourceId,
            platformType,
          },
          type: 'error',
          code: 'MAPPING_INCOMPLETE',
          message: 'Cannot generate preview without all required fields.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        type: 'error',
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
