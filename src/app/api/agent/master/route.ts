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
    
    // Simple intent detection (will be improved with agent reasoning later)
    const shouldGeneratePreview = 
      lastMessage.toLowerCase().includes('generate') ||
      lastMessage.toLowerCase().includes('create') ||
      lastMessage.toLowerCase().includes('build');
    
    if (shouldGeneratePreview && sourceId && platformType) {
      // Trigger workflow
      const result = await mastra.workflows.generatePreview.execute({
        triggerData: {
          tenantId,
          userId,
          sourceId,
          platformType,
        },
      });
      
      // Return structured result
      return new Response(
        JSON.stringify({
          type: 'workflow_complete',
          workflow: 'generate-preview',
          result: {
            previewUrl: result.results[persistPreviewVersion.id]?.previewUrl,
            interfaceId: result.results[persistPreviewVersion.id]?.interfaceId,
            versionId: result.results[persistPreviewVersion.id]?.versionId,
          },
          message: `✅ Dashboard preview generated! You can view it at ${result.results[persistPreviewVersion.id]?.previewUrl}`,
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
          type: 'error',
          code: 'MAPPING_INCOMPLETE',
          message: 'Cannot generate preview - some required fields are missing from your data.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        type: 'error',
        message: 'An error occurred while processing your request.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
