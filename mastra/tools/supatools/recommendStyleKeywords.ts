




import { createSupaTool } from './_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  selectedStoryboard: z.string().optional(),
});

const outputSchema = z.object({
  density: z.object({
    recommendation: z.enum(['compact', 'comfortable', 'spacious']),
    reason: z.string(),
  }),
  palette: z.object({
    recommendation: z.array(z.string()),
    reason: z.string(),
  }),
  typography: z.object({
    recommendation: z.string(),
    reason: z.string(),
  }),
  keywords: z.array(z.string()),
});

export const recommendStyleKeywords = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'recommendStyleKeywords',
  description: 'Analyze event patterns and context to recommend style keywords (density, palette, typography). Returns recommendations grounded in data characteristics. Used in Phase 3 style bundle generation.',
  inputSchema,
  outputSchema,


  execute: async (rawInput: unknown) => {
    const input = inputSchema.parse(rawInput);
    const { tenantId, sourceId, selectedStoryboard } = input;

    const supabase = createClient();

    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 3);

    let query = supabase
      .from('events')
      .select('type, name, value, labels', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('timestamp', sinceDate.toISOString())
      .limit(500);

    if (sourceId) query = query.eq('source_id', sourceId);

    const { data: events, error, count } = await query;
    if (error) throw new Error(`Failed to fetch style samples: ${error.message}`);
    
    // Analyze data characteristics
    const totalEvents = events?.length || 0;
    const uniqueEventTypes = new Set(events?.map(e => e.type) || []).size;
    const errorRate = (events?.filter(e => e.type === 'error').length || 0) / Math.max(totalEvents, 1);
    const hasComplexLabels = events?.some(e => 
      e.labels && typeof e.labels === 'object' && Object.keys(e.labels).length > 3
    ) || false;
    
    // Density recommendation
    let densityRecommendation: 'compact' | 'comfortable' | 'spacious';
    let densityReason: string;
    
    if (totalEvents > 5000 || hasComplexLabels) {
      densityRecommendation = 'compact';
      densityReason = 'High event volume or complex labels suggests data-dense displays are needed.';
    } else if (totalEvents > 1000) {
      densityRecommendation = 'comfortable';
      densityReason = 'Moderate event volume supports comfortable spacing for readability.';
    } else {
      densityRecommendation = 'spacious';
      densityReason = 'Lower event volume allows for spacious, focused displays.';
    }
    
    // Palette recommendation
    let paletteRecommendation: string[];
    let paletteReason: string;
    
    if (errorRate > 0.1) {
      paletteRecommendation = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6B7280'];
      paletteReason = 'High error rate detected; include strong red for errors, amber for warnings.';
    } else if (uniqueEventTypes >= 4) {
      paletteRecommendation = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#6366F1'];
      paletteReason = 'Multiple event types benefit from a vibrant, differentiated palette.';
    } else {
      paletteRecommendation = ['#2563EB', '#059669', '#7C3AED', '#0891B2', '#4B5563'];
      paletteReason = 'Simpler event structure works well with a professional, calm palette.';
    }
    
    // Typography recommendation
    let typographyRecommendation: string;
    let typographyReason: string;
    
    if (selectedStoryboard?.toLowerCase().includes('deep dive') || 
        selectedStoryboard?.toLowerCase().includes('analytics')) {
      typographyRecommendation = 'data-dense, small-to-medium, monospace-numbers';
      typographyReason = 'Deep-dive analytics requires data-dense typography with monospace numbers for precision.';
    } else if (selectedStoryboard?.toLowerCase().includes('real-time') || 
               selectedStoryboard?.toLowerCase().includes('operations')) {
      typographyRecommendation = 'medium, high-contrast, status-indicators';
      typographyReason = 'Real-time operations need high-contrast typography with clear status indicators.';
    } else {
      typographyRecommendation = 'medium, readable, hierarchy-focused';
      typographyReason = 'General dashboards benefit from readable, hierarchy-focused typography.';
    }
    
    // Generate keywords
    const keywords: string[] = [
      densityRecommendation,
      'data-visualization',
      errorRate > 0.05 ? 'error-aware' : 'stable',
      uniqueEventTypes >= 4 ? 'multi-dimensional' : 'focused',
      selectedStoryboard?.toLowerCase().includes('client') ? 'client-facing' : 'internal-ops',
    ];
    
    return {
      density: {
        recommendation: densityRecommendation,
        reason: densityReason,
      },
      palette: {
        recommendation: paletteRecommendation,
        reason: paletteReason,
      },
      typography: {
        recommendation: typographyRecommendation,
        reason: typographyReason,
      },
      keywords,
    };
  },
});




