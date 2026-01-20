import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const generateUISpec = createTool({
  id: 'generate-ui-spec',
  description: 'Generates dashboard UI specification JSON from template and mappings',
  inputSchema: z.object({
    templateId: z.string(),
    mappings: z.record(z.string()),
    platformType: z.string(),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  execute: async (inputData, context) => {
    const { templateId, mappings, platformType } = context;
    
    // Generate spec based on template (simplified for MVP)
    const spec_json = {
      version: '1.0',
      templateId,
      platformType,
      layout: {
        type: 'grid',
        columns: 12,
        gap: 4,
      },
      components: [] as any[],
    };
    
    // Add components based on template
    if (templateId === 'voice-agent-dashboard') {
      spec_json.components = [
        {
          id: 'total-calls',
          type: 'MetricCard',
          props: {
            title: 'Total Calls',
            valueField: mappings['call_id'] || 'id',
            aggregation: 'count',
            icon: 'phone',
          },
          layout: { col: 0, row: 0, w: 3, h: 2 },
        },
        {
          id: 'avg-duration',
          type: 'MetricCard',
          props: {
            title: 'Avg Duration',
            valueField: mappings['duration'] || 'duration',
            aggregation: 'avg',
            unit: 'seconds',
            icon: 'clock',
          },
          layout: { col: 3, row: 0, w: 3, h: 2 },
        },
        {
          id: 'success-rate',
          type: 'MetricCard',
          props: {
            title: 'Success Rate',
            valueField: mappings['status'] || 'status',
            aggregation: 'percentage',
            condition: { equals: 'success' },
            icon: 'check-circle',
          },
          layout: { col: 6, row: 0, w: 3, h: 2 },
        },
        {
          id: 'total-cost',
          type: 'MetricCard',
          props: {
            title: 'Total Cost',
            valueField: mappings['cost'] || 'cost',
            aggregation: 'sum',
            unit: 'USD',
            icon: 'dollar-sign',
          },
          layout: { col: 9, row: 0, w: 3, h: 2 },
        },
        {
          id: 'calls-timeline',
          type: 'TimeseriesChart',
          props: {
            title: 'Calls Over Time',
            xField: 'timestamp',
            yField: mappings['call_id'] || 'id',
            aggregation: 'count',
            interval: 'hour',
          },
          layout: { col: 0, row: 2, w: 8, h: 4 },
        },
        {
          id: 'status-breakdown',
          type: 'PieChart',
          props: {
            title: 'Call Status',
            field: mappings['status'] || 'status',
          },
          layout: { col: 8, row: 2, w: 4, h: 4 },
        },
        {
          id: 'recent-calls',
          type: 'DataTable',
          props: {
            title: 'Recent Calls',
            columns: [
              { key: mappings['call_id'] || 'id', label: 'Call ID' },
              { key: mappings['duration'] || 'duration', label: 'Duration' },
              { key: mappings['status'] || 'status', label: 'Status' },
              { key: 'timestamp', label: 'Time' },
            ],
            pageSize: 10,
          },
          layout: { col: 0, row: 6, w: 12, h: 4 },
        },
      ];
    } else {
      // Default template
      spec_json.components = [
        {
          id: 'total-events',
          type: 'MetricCard',
          props: {
            title: 'Total Events',
            valueField: 'id',
            aggregation: 'count',
          },
          layout: { col: 0, row: 0, w: 4, h: 2 },
        },
      ];
    }
    
    const design_tokens = {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
      },
      spacing: {
        unit: 4,
      },
    };
    
    return {
      spec_json,
      design_tokens,
    };
  },
});
