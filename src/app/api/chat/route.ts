
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { RequestContext } from '@mastra/core/request-context';
import { getMastra } from '@/mastra';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const params = await req.json();

    // Build RequestContext from `params.data` (official pattern: "Passing additional data")
    const requestContext = new RequestContext();

    const data = params?.data ?? {};
    for (const [key, value] of Object.entries(data)) {
      requestContext.set(key, value as any);
    }

    // Attach to params so tools/agents can read it
    const enhancedParams = {
      ...params,
      requestContext,
    };

    const mastra = getMastra();

    const stream = await handleChatStream({
      mastra,
      agentId: 'masterRouterAgent',
      params: enhancedParams,
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('[api/chat] error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

