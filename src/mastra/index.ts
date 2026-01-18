/**
 * Mastra CLI Entry Point (Bridge File)
 * 
 * This file exists solely to satisfy the Mastra CLI's hardcoded lookup path.
 * The CLI only looks for src/mastra/index.ts by convention.
 * 
 * All actual Mastra code lives in /mastra/ directory at project root.
 * This file simply re-exports everything to make it discoverable to the CLI.
 * 
 * DO NOT put actual Mastra logic here - keep it in /mastra/
 */

// Re-export all agents
export * from '../../mastra/agents';

// Re-export all tools
export * from '../../mastra/tools';

// Re-export all workflows
export * from '../../mastra/workflows';

// Re-export all skills
export * from '../../mastra/skills';

// Re-export main configuration/exports from mastra/index.ts
export * from '../../mastra';

