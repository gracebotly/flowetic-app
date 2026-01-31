

import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
});

const outputSchema = z.object({
  recommendedOutcome: z.enum(['dashboard', 'product']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  dataEvidence: z.object({
    totalEvents: z.number(),
    errorRate: z.number(),
    metricCount: z.number(),
    hasMetrics: z.boolean(),
    hasWorkflowEvents: z.boolean(),
  }),
});

export const recommendOutcome = createSupaTool({
  id: 'recommendOutcome',
  description: 'Analyze event patterns to recommend outcome type (dashboard vs product). Returns recommendation with confidence score and data-driven reasoning. Used in Phase 1 outcome selection.',
  inputSchema,
  outputSchema,
  execute: async ({ tenantId, sourceId }) => {
    const supabase = createClient();
    
    // Get event stats
    let query = supabase
      .from('events')
      .select('type, value')
      .eq('tenant_id', tenantId);
    
    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }
    
    const { data: events, error } = await query.limit(1000);
    
    if (error) {
      throw new Error(`Failed to analyze events for outcome recommendation: ${error.message}`);
    }
    
    const totalEvents = events?.length || 0;
    const errorCount = events?.filter(e => e.type === 'error').length || 0;
    const metricCount = events?.filter(e => e.type === 'metric').length || 0;
    const hasMetrics = metricCount > 0;
    const hasWorkflowEvents = events?.some(e => 
      ['message', 'tool_event', 'state'].includes(e.type)
    ) || false;
    
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0;
    
    // Recommendation logic
    let recommendedOutcome: 'dashboard' | 'product';
    let confidence: number;
    let reasoning: string;
    
    if (hasMetrics && hasWorkflowEvents) {
      recommendedOutcome = 'dashboard';
      confidence = 0.85;
      reasoning = 'Events contain both metrics and workflow activity, indicating a comprehensive monitoring dashboard would provide the best value.';
    } else if (hasMetrics && !hasWorkflowEvents) {
      recommendedOutcome = 'product';
      confidence = 0.75;
      reasoning = 'Events are primarily metrics without workflow context, suggesting a focused product metrics view would be more appropriate.';
    } else if (!hasMetrics && hasWorkflowEvents) {
      recommendedOutcome = 'dashboard';
      confidence = 0.70;
      reasoning = 'Events show workflow activity but lack metrics, indicating an operational dashboard to track workflow execution.';
    } else {
      recommendedOutcome = 'dashboard';
      confidence = 0.50;
      reasoning = 'Limited event data available; dashboard provides more flexibility as new event types are discovered.';
    }
    
    // Adjust confidence based on error rate
    if (errorRate > 0.1) {
      confidence = Math.max(confidence - 0.15, 0.4);
      reasoning += ' High error rate detected; recommend starting with dashboard to investigate issues.';
    }
    
    return {
      recommendedOutcome,
      confidence: Number(confidence.toFixed(2)),
      reasoning,
      dataEvidence: {
        totalEvents,
        errorRate: Number(errorRate.toFixed(3)),
        metricCount,
        hasMetrics,
        hasWorkflowEvents,
      },
    };
  },
});



