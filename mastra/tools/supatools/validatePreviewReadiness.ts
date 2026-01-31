


import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
});

const outputSchema = z.object({
  isReady: z.boolean(),
  checks: z.object({
    hasEvents: z.boolean(),
    eventsCount: z.number(),
    hasMetrics: z.boolean(),
    hasSufficientData: z.boolean(),
    errorRate: z.number(),
  }),
  recommendations: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export const validatePreviewReadiness = createSupaTool({
  id: 'validatePreviewReadiness',
  description: 'Validate if tenant has sufficient data for preview generation. Returns readiness status, data checks, and recommendations. Used before triggering preview workflow.',
  inputSchema,
  outputSchema,
  execute: async ({ tenantId, sourceId }) => {
    const supabase = createClient();
    
    // Get basic event stats
    let query = supabase
      .from('events')
      .select('type, value, timestamp')
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      throw new Error(`Failed to validate preview readiness: ${error.message}`);
    }
    
    const eventsCount = events?.length || 0;
    const hasEvents = eventsCount > 0;
    const hasMetrics = events?.some(e => e.type === 'metric') || false;
    const errorRate = eventsCount > 0 ? (events?.filter(e => e.type === 'error').length || 0) / eventsCount : 0;
    const hasSufficientData = eventsCount >= 10; // Minimum threshold
    
    // Generate recommendations
    const recommendations: string[] = [];
    const nextSteps: string[] = [];
    
    if (!hasEvents) {
      recommendations.push('No events found - data source needs to be connected and streaming');
      nextSteps.push('Run connection backfill workflow', 'Verify source configuration');
    } else if (eventsCount < 10) {
      recommendations.push('Limited event data - more events needed for meaningful preview');
      nextSteps.push('Wait for more events to accumulate', 'Check source connectivity');
    }
    
    if (!hasMetrics) {
      recommendations.push('No metric events detected - consider adding metric collection');
      nextSteps.push('Configure metric events in source', 'Add instrumentation if needed');
    }
    
    if (errorRate > 0.2) {
      recommendations.push(`High error rate (${(errorRate * 100).toFixed(1)}%) - investigate source issues`);
      nextSteps.push('Check source logs', 'Verify authentication and permissions');
    }
    
    if (errorRate > 0 && errorRate <= 0.2) {
      recommendations.push(`Moderate error rate (${(errorRate * 100).toFixed(1)}%) - monitor closely`);
    }
    
    const isReady = hasEvents && hasSufficientData && errorRate < 0.3;
    
    return {
      isReady,
      checks: {
        hasEvents,
        eventsCount,
        hasMetrics,
        hasSufficientData,
        errorRate: Number(errorRate.toFixed(3)),
      },
      recommendations,
      nextSteps,
    };
  },
});




