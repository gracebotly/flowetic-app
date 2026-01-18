/**
 * Mastra CLI Entry Point (Bridge File)
 * 
 * Re-exports for CLI - agents, tools, workflows, AND the mastra instance
 */

// Re-export individual primitives
export * from '../../mastra/agents';
export * from '../../mastra/tools';
export * from '../../mastra/workflows';
export * from '../../mastra/skills';

// Re-export the mastra instance for CLI
// This works because we disabled telemetry which was trying to use Next.js headers
export { mastra } from '../../mastra';
