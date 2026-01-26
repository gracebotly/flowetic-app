
import { CopilotRuntime } from '@copilotkit/runtime';
import { mastra } from '@/mastra';
import { NextRequest } from 'next/server';

// Custom action adapter to bridge CopilotKit with Mastra agent
const mastraActionAdapter = {
  actions: [
    {
      name: 'vibeRouterAgent',
      description: 'Routes user messages to appropriate vibe',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The user message to process',
          },
        },
        required: ['message'],
      },
      handler: async ({ message }: { message: string }) => {
        const agent = mastra.getAgent('vibeRouterAgent');
        if (!agent) {
          throw new Error('Agent not found');
        }
        
        const result = await agent.generate([
          {
            role: 'user',
            content: message,
          },
        ]);

        return result.text;
      },
    },
  ],
};

// CopilotKit runtime endpoint
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const copilotKit = new CopilotRuntime({
    actions: mastraActionAdapter.actions as unknown as any,
  });

  return copilotKit.serve(req);
}

export async function GET() {
  const agents = mastra.listAgents();
  
  return Response.json({
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
    })),
  });
}
