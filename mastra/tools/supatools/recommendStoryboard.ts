


import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  sourceId: z.string().uuid().optional(),
  selectedOutcome: z.enum(['dashboard', 'product']),
});

// NEW: Request context schema (Mastra 1.1.0 feature)
const requestContextSchema = z.object({
  tenantId: z.string().uuid(),  // ✅ Validated from server
  userId: z.string().uuid(),
});

const outputSchema = z.object({
  recommendedStoryboard: z.string(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    storyboard: z.string(),
    reason: z.string(),
  })),
  reasoning: z.string(),
});

export const recommendStoryboard = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'recommendStoryboard',
  description: 'Analyze event schema and patterns to recommend storyboard type. Returns top recommendation with alternatives. Used in Phase 2 storyboard selection.',
  inputSchema,
  outputSchema,
  requestContextSchema,  // ✅ Add this

  execute: async (rawInput: unknown, context) => {
    const input = inputSchema.parse(rawInput);
    
    // ✅ Get tenantId from VALIDATED context, not input
    const tenantId = context.requestContext?.get('tenantId');
    
    if (!tenantId) {
      throw new Error('recommendStoryboard: tenantId missing from request context');
    }
    
    const { sourceId, selectedOutcome } = input;

    const supabase = createClient();

    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 7);

    let query = supabase
      .from('events')
      .select('type, name, value, labels', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('timestamp', sinceDate.toISOString())
      .limit(200);

    if (sourceId) query = query.eq('source_id', sourceId);

    const { data: events, error, count } = await query;
    if (error) throw new Error(`Failed to analyze events: ${error.message}`);


    const types: string[] = (events ?? []).map((e: any) => e.type).filter(Boolean);
    const eventTypes = new Set(types);

    const hasMetrics = eventTypes.has('metric');
    const hasErrors = eventTypes.has('error');
    const hasWorkflow = eventTypes.has('message') || eventTypes.has('tool_event');
    const uniqueLabels = new Set<string>();
    
    events?.forEach(e => {
      if (e.labels && typeof e.labels === 'object') {
        Object.keys(e.labels).forEach(key => uniqueLabels.add(key));
      }
    });
    
    const hasLabels = uniqueLabels.size > 0;
    const labelVariety = uniqueLabels.size;
    
    // Recommendation logic
    let recommendedStoryboard: string;
    let confidence: number;
    let reasoning: string;
    const alternatives: Array<{ storyboard: string; reason: string }> = [];
    
    if (selectedOutcome === 'product') {
      // Product outcome storyboards
      if (hasMetrics && labelVariety >= 3) {
        recommendedStoryboard = 'Product Metrics Deep Dive';
        confidence = 0.85;
        reasoning = `Event data shows rich metrics with ${labelVariety} label dimensions, indicating a deep-dive analytics approach will reveal product insights.`;
        alternatives.push(
          { storyboard: 'Feature Usage Overview', reason: 'Simpler view focusing on top metrics by feature.' },
          { storyboard: 'User Journey Tracking', reason: 'If events contain user/session identifiers.' }
        );
      } else if (hasMetrics && labelVariety < 3) {
        recommendedStoryboard = 'Feature Usage Overview';
        confidence = 0.75;
        reasoning = 'Metrics available but with limited label dimensions; an overview approach focuses on key product KPIs.';
        alternatives.push(
          { storyboard: 'Product Metrics Deep Dive', reason: 'As more event dimensions are added.' },
          { storyboard: 'Health & Status Report', reason: 'For monitoring product stability.' }
        );
      } else {
        recommendedStoryboard = 'Health & Status Report';
        confidence = 0.60;
        reasoning = 'Limited metric data available; focus on product health and status indicators.';
        alternatives.push(
          { storyboard: 'Feature Usage Overview', reason: 'As more metric events are collected.' },
          { storyboard: 'Performance Snapshot', reason: 'For real-time product monitoring.' }
        );
      }
    } else {
      // Dashboard outcome storyboards
      if (hasMetrics && hasWorkflow && hasErrors) {
        recommendedStoryboard = 'Workflow Performance & Reliability';
        confidence = 0.90;
        reasoning = 'Event data combines metrics, workflow activity, and errors—perfect for performance and reliability tracking.';
        alternatives.push(
          { storyboard: 'Real-Time Operations Dashboard', reason: 'For live monitoring of workflow execution.' },
          { storyboard: 'Error Analysis & Debugging', reason: 'For deeper investigation of workflow issues.' }
        );
      } else if (hasMetrics && hasWorkflow) {
        recommendedStoryboard = 'Real-Time Operations Dashboard';
        confidence = 0.80;
        reasoning = 'Events show workflow activity with metrics—ideal for real-time operations visibility.';
        alternatives.push(
          { storyboard: 'Workflow Performance & Reliability', reason: 'As error tracking is added.' },
          { storyboard: 'Workflow Analytics Summary', reason: 'For historical analysis of workflow performance.' }
        );
      } else if (hasErrors) {
        recommendedStoryboard = 'Error Analysis & Debugging';
        confidence = 0.75;
        reasoning = 'High error rate detected; focus on error analysis and debugging capabilities.';
        alternatives.push(
          { storyboard: 'Workflow Performance & Reliability', reason: 'For broader performance context.' },
          { storyboard: 'Error Prevention Dashboard', reason: 'For proactive error monitoring.' }
        );
      } else {
        recommendedStoryboard = 'Workflow Analytics Summary';
        confidence = 0.65;
        reasoning = 'Event data available but limited; summary view provides foundational workflow insights.';
        alternatives.push(
          { storyboard: 'Real-Time Operations Dashboard', reason: 'As workflow event volume increases.' },
          { storyboard: 'Workflow Performance & Reliability', reason: 'For more detailed performance tracking.' }
        );
      }
    }
    
    return {
      recommendedStoryboard,
      confidence: Number(confidence.toFixed(2)),
      alternatives,
      reasoning,
    };
  },
});



