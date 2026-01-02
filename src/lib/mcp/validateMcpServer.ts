
import { MCPClient } from "@mastra/mcp";

export type McpValidationResult = {
  ok: boolean;
  toolCount?: number;
  serverId?: string;
  error?: string;
};

export async function validateMcpServer(params: {
  serverId: string;
  url: string;
  headers?: Record<string, string>;
}): Promise<McpValidationResult> {
  try {
    const mcp = new MCPClient({
      id: `validate-${params.serverId}`,
      servers: {
        [params.serverId]: {
          url: new URL(params.url),
          requestInit: params.headers
            ? { headers: params.headers }
            : undefined,
        },
      },
      timeout: 20000,
    });

    const toolsets = await mcp.getToolsets();
    const toolset = toolsets[params.serverId];

    const tools = toolset?.tools ?? {};
    const toolCount = Object.keys(tools).length;

    return { ok: true, toolCount, serverId: params.serverId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

