




import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const listTemplates = createTool({
  id: 'listTemplates',
  description: 'List available dashboard templates',
  // inputSchema: z.object({
  //   platformType: z.string().optional().describe('Filter by platform type'),
  //   category: z.string().optional().describe('Filter by template category'),
  // }),
  outputSchema: z.object({
    templates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      platformType: z.string(),
      requiredFields: z.array(z.string()),
      optionalFields: z.array(z.string()),
      supportedEventTypes: z.array(z.string()),
      preview: z.string().optional(),
    })),
  }),
  execute: async (inputData: any, context: any) => {
    const { platformType, category } = inputData || {};

    try {
      // Mock templates data
      const templates = [
        {
          id: 'call-center-dashboard',
          name: 'Call Center Dashboard',
          description: 'Comprehensive call center analytics with volume, duration, and performance metrics',
          category: 'customer-service',
          platformType: 'vapi',
          requiredFields: ['customer.name', 'agent.name', 'duration', 'status'],
          optionalFields: ['outcome', 'revenue', 'department'],
          supportedEventTypes: ['call.started', 'call.ended', 'call.missed'],
          preview: '/templates/call-center.png',
        },
        {
          id: 'sales-dashboard',
          name: 'Sales Performance Dashboard',
          description: 'Track sales metrics, conversion rates, and revenue trends',
          category: 'sales',
          platformType: 'vapi',
          requiredFields: ['customer.name', 'outcome', 'revenue'],
          optionalFields: ['agent.name', 'duration', 'department'],
          supportedEventTypes: ['call.ended', 'sale.completed', 'lead.created'],
          preview: '/templates/sales.png',
        },
        {
          id: 'support-dashboard',
          name: 'Customer Support Dashboard',
          description: 'Monitor support tickets, resolution times, and customer satisfaction',
          category: 'customer-service',
          platformType: 'vapi',
          requiredFields: ['customer.name', 'issue.type', 'status'],
          optionalFields: ['resolution.time', 'satisfaction.rating'],
          supportedEventTypes: ['ticket.created', 'ticket.resolved', 'ticket.escalated'],
          preview: '/templates/support.png',
        },
      ];

      // Apply filters
      let filteredTemplates = templates;
      if (platformType) {
        filteredTemplates = filteredTemplates.filter(t => t.platformType === platformType);
      }
      if (category) {
        filteredTemplates = filteredTemplates.filter(t => t.category === category);
      }

      return {
        templates: filteredTemplates,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list templates: ${message}`);
    }
  },
});




