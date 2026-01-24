





import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const saveMapping = createTool({
  id: 'saveMapping',
  description: 'Save mapping configuration to database',
  inputSchema: z.object({
    tenantId: z.string().describe('Tenant ID'),
    userId: z.string().describe('User ID'),
    interfaceId: z.string().describe('Interface ID'),
    templateId: z.string().describe('Template ID'),
    mappings: z.record(z.string()).describe('Field mappings'),
    confidence: z.number().describe('Mapping confidence score'),
    metadata: z.object({
      platformType: z.string(),
      sourceId: z.string(),
      eventTypes: z.array(z.string()),
      unmappedFields: z.array(z.string()).optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mappingId: z.string(),
    savedAt: z.string(),
    confidence: z.number(),
    fieldCount: z.number(),
    requiresReview: z.boolean(),
  }),
  execute: async (inputData, context) => {
    const { tenantId, userId, interfaceId, templateId, mappings, confidence, metadata } = inputData;

    try {
      // Validate inputs
      if (!tenantId || !userId || !interfaceId) {
        throw new Error('Missing required identifiers');
      }

      if (!mappings || Object.keys(mappings).length === 0) {
        throw new Error('No mappings provided');
      }

      // Generate mapping ID
      const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // In a real implementation, this would save to database
      // Simulate database save
      const mappingRecord = {
        id: mappingId,
        tenantId,
        userId,
        interfaceId,
        templateId,
        mappings,
        confidence,
        metadata,
        createdAt: new Date().toISOString(),
        status: confidence >= 0.8 ? 'approved' : 'pending_review',
      };

      console.log('Saving mapping:', JSON.stringify(mappingRecord, null, 2));

      // Determine if review is needed
      const requiresReview = confidence < 0.7 || 
                           Boolean(metadata.unmappedFields && metadata.unmappedFields.length > 0);

      return {
        success: true,
        mappingId,
        savedAt: mappingRecord.createdAt,
        confidence,
        fieldCount: Object.keys(mappings).length,
        requiresReview: false,  // FIXED: Explicit boolean value instead of optional
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save mapping: ${message}`);
    }
  },
});





