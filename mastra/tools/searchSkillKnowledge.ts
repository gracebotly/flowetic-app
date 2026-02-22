import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { workspace } from '@/mastra/workspace';

/**
 * searchSkillKnowledge — On-demand BM25 search over platform skills,
 * business frameworks, and design guidelines.
 *
 * This replaces injecting full skill content (~25K tokens) into the
 * system prompt. The agent calls this tool when it needs specific
 * knowledge about n8n patterns, business outcome frameworks, etc.
 *
 * The workspace must have bm25: true and autoIndexPaths: ['/skills']
 * configured so skill SKILL.md files are indexed on init().
 *
 * NOTE: There is NO mastra_workspace_grep tool in Mastra.
 * Official search tools: mastra_workspace_search (BM25/vector/hybrid)
 * and mastra_workspace_index. See:
 * https://mastra.ai/reference/workspace/workspace-class#search-tools
 */
export const searchSkillKnowledge = createTool({
  id: 'searchSkillKnowledge',
  description: 'Search platform knowledge, business frameworks, and design guidelines. Use this to find specific n8n patterns, field mappings, KPI recommendations, outcome frameworks, or template guidance when needed.',
  inputSchema: z.object({
    query: z.string().describe('What to search for (e.g., "n8n execution time metrics", "SaaS retention KPIs", "client dashboard outcome framing")'),
    domain: z.enum(['platform', 'business', 'design', 'all']).optional().default('all').describe('Narrow search to a specific knowledge domain, or "all" to search everything'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      content: z.string(),
      source: z.string().optional(),
      score: z.number(),
    })),
    resultCount: z.number(),
  }),
  execute: async ({ query, domain }) => {
    try {
      const results = await workspace.search(query, {
        topK: domain === 'all' ? 5 : 3,
        mode: 'bm25',
      });

      // Filter by domain if specified (skill files have paths like /skills/n8n/SKILL.md)
      const domainPathMap: Record<string, string[]> = {
        platform: ['n8n', 'make', 'vapi', 'zapier'],
        business: ['business-outcomes-advisor'],
        design: ['ui-ux-pro-max'],
      };

      const filtered = domain && domain !== 'all'
        ? results.filter(r => {
            const path = String(r.id || r.metadata?.path || '');
            return domainPathMap[domain]?.some(d => path.includes(d)) ?? false;
          })
        : results;

      return {
        results: filtered.slice(0, 5).map(r => ({
          content: r.content?.substring(0, 800) || '',
          source: String(r.id || r.metadata?.path || 'unknown'),
          score: r.score ?? 0,
        })),
        resultCount: filtered.length,
      };
    } catch (error) {
      console.error('[searchSkillKnowledge] Search failed:', error);
      return {
        results: [],
        resultCount: 0,
      };
    }
  },
});
