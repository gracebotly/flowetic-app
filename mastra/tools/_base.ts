
import { createTool } from '@mastra/core/tools';
import { extractTenantContext } from '../lib/tenant-verification';

export function createSupaTool<TOut>(config: {
  id: string;
  description: string;
  inputSchema: { parse: (input: unknown) => unknown };
  outputSchema: unknown;
  execute: (input: unknown, context: any) => Promise<TOut>;
}) {
  return createTool({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema as any,
    outputSchema: config.outputSchema as any,
    execute: async (inputData: unknown, context: any) => {
      // Extract tenant context (validates presence of tenantId and userId)
      const { tenantId, userId } = extractTenantContext(context);

      try {
        return await config.execute(inputData, context);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Supatool "${config.id}" failed: ${msg}`);
      }
    },
  });
}
