import { Workspace } from '@mastra/core/workspace';

/**
 * Skills-only Workspace for serverless environments.
 *
 * This workspace provides ONLY skills - no filesystem and no sandbox.
 * This configuration is compatible with Vercel serverless functions because:
 * - Skills are loaded read-only at initialization
 * - No persistent filesystem is required
 * - No filesystem tools are exposed to agents
 *
 * The skills are located at /workspace/skills and are loaded via LocalSkillSource.
 * Agents can search and use these skills but cannot read/write files.
 */
export const workspace = new Workspace({
  id: 'flowetic-workspace',
  name: 'Flowetic Workspace',
  
  // Skills: Agent Skills spec directories
  skills: ['/skills'],
  
  // BM25 search for skill-based recommendations (still works without filesystem)
  bm25: true,
  
  // Note: No filesystem or sandbox configured for serverless compatibility
  // Skills are loaded read-only from /workspace/skills at initialization
});