import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { workspace } from '@/mastra/workspace';
import { ensureUIUXSearchInitialized } from '@/mastra/tools/uiux/initUIUXSearch';

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
// ── BM25 query optimizer ──────────────────────────────────────────────
// BM25 works best with 2-5 targeted keywords. The agent tends to send
// 15+ word natural-language queries that dilute term frequency to zero.
// This extracts the most meaningful terms.
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'ought',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
  'they', 'them', 'their', 'this', 'that', 'these', 'those', 'what',
  'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'and', 'or', 'but', 'if', 'then', 'so', 'for', 'of', 'to', 'in',
  'on', 'at', 'by', 'with', 'from', 'up', 'out', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'not', 'no', 'nor', 'only', 'very', 'just', 'also', 'more', 'most',
  'any', 'all', 'each', 'every', 'both', 'few', 'some', 'such',
  // Domain-generic words the agent overuses:
  'dashboard', 'layout', 'overview', 'monitoring', 'breakdown',
  'analytical', 'executive', 'operational', 'skeleton', 'first',
  'storyboard', 'insight', 'based', 'using', 'show', 'display',
]);

function truncateForBM25(query: string): string {
  // Split, remove stop words and parenthetical content, keep meaningful terms
  const cleaned = query
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content like "(Productized Workflow)"
    .replace(/["']/g, '')     // Remove quotes
    .toLowerCase();

  const words = cleaned
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // Keep max 5 keywords — enough for BM25 precision without dilution
  const keywords = words.slice(0, 5);

  // If all words were stop words, fall back to first 3 original words
  if (keywords.length === 0) {
    return query.split(/\s+/).slice(0, 3).join(' ');
  }

  return keywords.join(' ');
}

export const searchSkillKnowledge = createTool({
  id: 'searchSkillKnowledge',
  description: 'Search platform knowledge, business frameworks, design guidelines, and dashboard intelligence via BM25 keyword search. CRITICAL: Use 2-4 keyword queries only (e.g., "dark dashboard style", "chart time series"). Long queries return 0 results. Domains: "dashboard" = field-to-component mapping, chart selection, hero stats. "design" = UI styles, typography, colors, layout patterns. "platform" = n8n/make/vapi/retell patterns. "business" = outcome frameworks, monetization. "all" = search everything.',
  inputSchema: z.object({
    query: z.string().describe('2-4 keyword search query. GOOD: "n8n execution metrics", "SaaS dashboard style", "dark mode monitoring". BAD: "AI Research Agent Productized Workflow dashboard layout skeleton executive overview" (too long, returns 0 results)'),
    domain: z.enum(['platform', 'business', 'design', 'dashboard', 'all']).optional().default('all').describe('Narrow search to a specific knowledge domain: platform (n8n/make/vapi/zapier), business (outcomes/monetization), design (ui-ux styles/typography/charts + dashboard intelligence), dashboard (field mapping/chart selection/story structure/hero stats), or "all"'),
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
      // ── FIX 1: Ensure UIUX CSV rows are indexed before searching ────
      // Without this, cold-start serverless instances have an empty BM25
      // index (only SKILL.md files from autoIndexPaths, no CSV data).
      // The generatePreview workflow calls this but searchSkillKnowledge
      // never did — causing 0 results on the agent's conversational path.
      try {
        await ensureUIUXSearchInitialized();
      } catch (initErr) {
        console.warn('[searchSkillKnowledge] UIUX init failed (non-fatal):', initErr);
      }

      // ── FIX 2: Truncate long queries for BM25 ──────────────────────
      // BM25 is a keyword-matching algorithm. Queries >6 words dilute
      // term frequency and return 0 results. Extract the most meaningful
      // 2-5 keywords from the agent's query.
      const truncatedQuery = truncateForBM25(query);

      const results = await workspace.search(truncatedQuery, {
        topK: domain === 'all' ? 8 : 6,
        mode: 'bm25',
      });

      // ── FIX 3: Widened domain path filter + fallback ────────────────
      // Two index sources:
      //   1. autoIndexPaths: ['/skills'] → paths like /skills/<folder>/SKILL.md
      //   2. initUIUXSearch() → IDs like uiux-style-row-0, uiux-chart-row-5
      //   3. initUIUXSearch() → metadata.domain like "style", "chart", "product"
      // Each domain entry includes path patterns AND metadata domain values.
      const domainPathMap: Record<string, string[]> = {
        platform: ['n8n', 'make', 'vapi', 'zapier', 'retell'],
        business: ['business-outcomes-advisor', 'uiux-product', 'uiux-landing', 'product', 'landing'],
        design: ['ui-ux-pro-max', 'uiux-', 'data-dashboard-intelligence', 'style', 'color', 'typography', 'icons', 'web-interface', 'ui-reasoning'],
        dashboard: ['data-dashboard-intelligence', 'uiux-chart', 'uiux-product', 'uiux-reasoning', 'chart', 'product', 'ui-reasoning', 'style'],
      };

      let filtered: typeof results;

      if (domain && domain !== 'all') {
        filtered = results.filter(r => {
          const docId = String(r.id || '');
          const docPath = String(r.metadata?.path || '');
          const metaDomain = String(r.metadata?.domain || '');
          const combined = `${docId} ${docPath} ${metaDomain}`;
          return domainPathMap[domain]?.some(d => combined.includes(d)) ?? false;
        });

        // Fallback: if domain filter produced 0 results, return unfiltered
        // results rather than nothing. Better to give cross-domain results
        // than leave the agent flying blind.
        if (filtered.length === 0 && results.length > 0) {
          console.warn(
            `[searchSkillKnowledge] Domain "${domain}" filter returned 0/${results.length} results. ` +
            `Falling back to unfiltered. Query: "${truncatedQuery}"`
          );
          filtered = results;
        }
      } else {
        filtered = results;
      }

      const mapped = filtered.slice(0, 5).map(r => ({
        content: r.content?.substring(0, 800) || '',
        source: String(r.id || r.metadata?.path || r.metadata?.domain || 'unknown'),
        score: r.score ?? 0,
      }));

      console.log(
        `[searchSkillKnowledge] domain="${domain}" query="${truncatedQuery}" → ${mapped.length} results ` +
        `(raw=${results.length}, filtered=${filtered.length})`
      );

      return {
        results: mapped,
        resultCount: mapped.length,
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
