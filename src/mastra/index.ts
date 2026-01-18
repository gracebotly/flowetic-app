/**
 * Mastra CLI Entry Point (Bridge File)
 * 
 * CRITICAL: Only export agents, tools, workflows, skills
 * DO NOT export the main Mastra instance - it has Next.js dependencies
 */

// Re-export agents (CLI needs these)
export * from '../../mastra/agents';

// Re-export tools (CLI needs these)
export * from '../../mastra/tools';

// Re-export workflows (CLI needs these)
export * from '../../mastra/workflows';

// Re-export skills (CLI needs these)
export * from '../../mastra/skills';

// DO NOT export from '../../mastra' - it imports Next.js modules

