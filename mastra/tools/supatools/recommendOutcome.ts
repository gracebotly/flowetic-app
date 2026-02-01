

import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  sourceId: z.string().uuid().optional(),
  sinceDays: z.number().int().min(1).max(365).default(30),
});

// NEW: Request context schema (Mastra 1.1.0 feature)
const requestContextSchema = z.object({
  tenantId: z.string().uuid(),  // ✅ Validated from server
  userId: z.string().uuid(),
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

export const recommendOutcome = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'recommendOutcome',
  description: 'Analyze event patterns to recommend outcome type (dashboard vs product). Returns recommendation with confidence score and data-driven reasoning. Used in Phase 1 outcome selection.',
  inputSchema,
  outputSchema,
  requestContextSchema,  // ✅ Add this
  
  execute: async (rawInput: unknown, context) => {
    const input = inputSchema.parse(rawInput);
    
    // ✅ Get tenantId from VALIDATED context, not input
    const tenantId = context.requestContext?.get('tenantId');
    
    if (!tenantId) {
      throw new Error('recommendOutcome: tenantId missing from request context');
    }
    
    const { sourceId, sinceDays } = input;

    const supabase = createClient();

    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - sinceDays);

    let query = supabase
      .from('events')
      .select('type', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('timestamp', sinceDate.toISOString())
      .limit(1000);

    if (sourceId) query = query.eq('source_id', sourceId);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to analyze events: ${error.message}`);
    const types: string[] = (data ?? []).map((e: any) => e.type).filter(Boolean);

    const totalEvents = typeof count === 'number' ? count : types.length;
    const errorCount = types.filter((t) => t === 'error').length;
    const metricCount = types.filter((t) => t === 'metric').length;

    const hasMetrics = metricCount > 0;
    const hasWorkflowEvents = types.some((t) => t === 'message' || t === 'tool_event' || t === 'state');

    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0;
    
    let recommendedOutcome: 'dashboard' | 'product' = 'dashboard';
    let confidence = 0.6;
    let reasoning = 'Defaulting to dashboard for flexibility given limited signals.';
    
    if (hasMetrics && hasWorkflowEvents) {
      recommendedOutcome = 'dashboard';
      confidence = 0.85;
      reasoning =
        'Events include both metrics and workflow activity; a dashboard is the best fit for monitoring and insights.';
    } else if (hasMetrics && !hasWorkflowEvents) {
      recommendedOutcome = 'product';
      confidence = 0.75;
      reasoning =
        'Events appear mostly metric-driven with limited workflow context; a product-style KPI view may be a better starting point.';
    } else if (!hasMetrics && hasWorkflowEvents) {
      recommendedOutcome = 'dashboard';
      confidence = 0.70;
      reasoning =
        'Events show workflow activity without strong metric coverage; an ops dashboard still provides value for execution visibility.';
    } else {
      recommendedOutcome = 'dashboard';
      confidence = 0.50;
      reasoning = 'Limited event data available; dashboard provides more flexibility as new event types are discovered.';
    }
    
    // Adjust confidence based on error rate
    if (errorRate > 0.1) {
      confidence = Math.max(confidence - 0.15, 0.4);
      reasoning += ' Elevated error rate suggests prioritizing operational visibility and debugging.';
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



