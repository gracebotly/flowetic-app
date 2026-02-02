import { Workspace, LocalFilesystem } from '@mastra/core/workspace';

/**
 * Main workspace instance for Flowetic app.
 * 
 * Configuration:
 * - Filesystem: Local disk storage at workspace path
 * - Skills: Agent Skills spec for platform instructions
 * - BM25: Keyword search for indexed workflows (Phase 3)
 * 
 * Features:
 * - Filesystem tools: read, write, list, delete files
 * - Skill discovery: Automatic SKILL.md discovery in workspace/skills/
 * - Search: BM25 keyword search (enabled for workflow indexing)
 */
export const workspace = new Workspace({
  id: 'flowetic-workspace',
  name: 'Flowetic Workspace',
  
  // Filesystem: Local disk storage
  filesystem: new LocalFilesystem({
    basePath: process.env.WORKSPACE_PATH || './workspace',
  }),
  
  // Skills: Agent Skills spec directories
  skills: ['/skills'],
  
  // BM25 search for workflow indexing (Phase 3)
  bm25: true,
  
  // Auto-index: Will be configured in Phase 3
  autoIndexPaths: [], // Empty for now, configured in Phase 3
});