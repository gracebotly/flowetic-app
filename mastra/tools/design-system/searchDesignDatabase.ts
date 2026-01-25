

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export const searchDesignDatabase = createTool({
  id: 'design-system.searchDesignDatabase',
  description: 'Search UI/UX Pro Max design database with optional domain/stack filters',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    domain: z.enum(['style', 'color', 'typography', 'landing', 'chart', 'ux', 'product']).optional().describe('Domain filter'),
    stack: z.enum(['html-tailwind', 'react', 'nextjs', 'vue', 'svelte', 'swiftui', 'react-native', 'flutter', 'shadcn', 'jetpack-compose']).optional().describe('Stack filter'),
    maxResults: z.number().int().min(1).max(10).optional().default(3).describe('Max results (default: 3)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const scriptPath = path.join(
      process.cwd(),
      '.agent',
      'skills',
      'ui-ux-pro-max',
      'scripts',
      'search.py'
    );
    
    // Build command arguments
    const args = ['python3', `"${scriptPath}"`, `"${context.query}"`];
    
    if (context.domain) {
      args.push(`--domain ${context.domain}`);
    } else if (context.stack) {
      args.push(`--stack ${context.stack}`);
    }
    
    args.push(`-n ${context.maxResults}`);
    
    const command = args.join(' ');
    
    try {
      console.log('[TOOL] searchDesignDatabase - Executing:', { query: context.query, domain: context.domain, stack: context.stack });
      console.log('[TOOL] searchDesignDatabase - Command:', command);
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        cwd: process.cwd(),
      });
      
      if (stderr) {
        console.log('[TOOL] searchDesignDatabase - Stderr:', stderr);
      }
      
      const output = stdout.trim();
      console.log('[TOOL] searchDesignDatabase - Success: true');
      
      return {
        success: true,
        output,
      };
    } catch (error: any) {
      console.log('[TOOL] searchDesignDatabase - Error:', error.message);
      return {
        success: false,
        output: '',
        error: error.message,
      };
    }
  },
});


