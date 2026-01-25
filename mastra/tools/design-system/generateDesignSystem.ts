
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export const generateDesignSystem = createTool({
  id: 'design-system.generateDesignSystem',
  description: 'Generate a complete design system using UI/UX Pro Max Python script with --design-system flag',
  inputSchema: z.object({
    query: z.string().describe('Search query for design system generation'),
    projectName: z.string().optional().describe('Optional project name for design system output'),
    format: z.enum(['ascii', 'markdown']).optional().default('ascii').describe('Output format'),
    persist: z.boolean().optional().default(false).describe('Whether to persist to design-system/ folder'),
    page: z.string().optional().describe('Page-specific override (requires persist=true)'),
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
    const args = ['python3', `"${scriptPath}"`, `"${context.query}"`, '--design-system'];
    
    if (context.projectName) {
      args.push(`-p "${context.projectName}"`);
    }
    
    if (context.format) {
      args.push(`-f ${context.format}`);
    }
    
    if (context.persist) {
      args.push('--persist');
    }
    
    if (context.page) {
      args.push(`--page "${context.page}"`);
    }
    
    const command = args.join(' ');
    
    try {
      console.log('[TOOL] generateDesignSystem - Executing:', { query: context.query, projectName: context.projectName });
      console.log('[TOOL] generateDesignSystem - Command:', command);
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        cwd: process.cwd(),
      });
      
      if (stderr) {
        console.log('[TOOL] generateDesignSystem - Stderr:', stderr);
      }
      
      const output = stdout.trim();
      console.log('[TOOL] generateDesignSystem - Output length:', output.length);
      console.log('[TOOL] generateDesignSystem - Success: true');
      
      return {
        success: true,
        output,
      };
    } catch (error: any) {
      console.log('[TOOL] generateDesignSystem - Error:', error.message);
      return {
        success: false,
        output: '',
        error: error.message,
      };
    }
  },
});

