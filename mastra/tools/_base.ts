
import { createTool } from '@mastra/core/tools';
import { extractAuthContext, verifyTenantAccess } from '../lib/tenant-verification';

export function createSupaTool<TOut>(config: {
  id: string;
  description: string;
  inputSchema: { parse: (input: unknown) => unknown };
  outputSchema: unknown;
  requestContextSchema?: unknown;
  execute: (input: unknown, context: any) => Promise<TOut>;
}) {
  return createTool({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema as any,
    outputSchema: config.outputSchema as any,
    requestContextSchema: config.requestContextSchema as any,
    execute: async (inputData: unknown, context: any) => {
      const { tenantId, userId } = extractAuthContext(context);
      await verifyTenantAccess(tenantId, userId);

      try {
        return await config.execute(inputData, context);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Supatool "${config.id}" failed: ${msg}`);
      }
    },
  });
}
