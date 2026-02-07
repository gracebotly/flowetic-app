import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import path from 'path';

/**
 * Skills-enabled Workspace with LocalFilesystem for serverless environments.
 *
 * This workspace provides skills with filesystem access for reading SKILL.md files.
 * This configuration is compatible with Vercel serverless functions because:
 * - Skills are loaded read-only at initialization
 * - LocalFilesystem is read-only and safe for serverless
 * - No sandbox is required
 *
 * The skills are located at /workspace/skills and are loaded via LocalSkillSource.
 * The filesystem enables skills to load SKILL.md documentation files.
 */
export const workspace = new Workspace({
  id: 'flowetic-workspace',
  name: 'Flowetic Workspace',

  // CRITICAL: Filesystem required for skills to load SKILL.md files
  filesystem: new LocalFilesystem({
    basePath: path.join(process.cwd(), 'workspace'),
    readOnly: true, // Safe for Vercel serverless
  }),

  // Skills: Agent Skills spec directories
  skills: ['/skills'],

  // BM25 search for skill-based recommendations
  bm25: true,
});