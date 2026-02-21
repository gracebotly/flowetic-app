import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { workspace } from '@/mastra/workspace';

/**
 * searchSkillKnowledge — Fast regex search over workspace skills.
 *
 * Replaces BM25 search with grep for exact pattern matching.
 * Use for finding specific code patterns, function names, or exact phrases
 * in skill documentation.
 *
 * The workspace grep tool is automatically available when filesystem
 * is configured (Mastra 1.5.0+).
 */
export const searchSkillKnowledge = createTool({
  id: 'searchSkillKnowledge',
  description: 'Search platform knowledge and design guidelines using regex patterns. Use this to find specific n8n patterns, shadcn components, field mappings, KPI recommendations, or template guidance. Examples: "shadcn.*Button", "n8n.*execution", "KPI.*retention"',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for (e.g., "shadcn.*Button", "n8n.*workflow")'),
    domain: z.enum(['platform', 'business', 'design', 'all']).optional().default('all').describe('Narrow search to specific skill domain: platform (n8n/make/vapi), business (outcomes/KPIs), design (ui-ux-pro-max), or all'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      file: z.string(),
      lineNumber: z.number(),
      content: z.string(),
    })),
    resultCount: z.number(),
    pattern: z.string(),
  }),
  execute: async ({ pattern, domain }) => {
    try {
      // Map domain to skill paths
      const domainPathMap: Record<string, string> = {
        platform: '/skills/n8n',
        business: '/skills/business-outcomes-advisor',
        design: '/skills/ui-ux-pro-max',
        all: '/skills',
      };
      const searchPath = domainPathMap[domain ?? 'all'] || '/skills';

      // Call the workspace grep tool (available in Mastra 1.5.0+ with filesystem configured)
      const grepResults = await (workspace as any).tools.mastra_workspace_grep({
        pattern,
        path: searchPath,
      });

      // Parse and format results
      const results = (grepResults as string).split('\n')
        .filter(Boolean)
        .map((line: string) => {
          // Parse grep output: file:lineNumber:content
          const match = line.match(/^(.+?):(\d+):(.+)$/);
          if (!match) return null;
          const [, file, lineNumber, content] = match;
          return {
            file,
            lineNumber: parseInt(lineNumber, 10),
            content: content.trim(),
          };
        })
        .filter(Boolean) as { file: string; lineNumber: number; content: string }[];

      return {
        results,
        resultCount: results.length,
        pattern,
      };
    } catch (error) {
      console.error('[searchSkillKnowledge] Grep failed:', error);
      return {
        results: [],
        resultCount: 0,
        pattern,
      };
    }
  },
});
