import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const saveMapping = createTool({
  id: "saveMapping",
  description: "Save mapping configuration to database",
  inputSchema: z.object({
    tenantId: z.string().describe("Tenant ID"),
    userId: z.string().describe("User ID"),
    interfaceId: z.string().describe("Interface ID"),
    templateId: z.string().describe("Template ID"),
    mappings: z.record(z.string()).describe("Field mappings"),
    confidence: z.number().describe("Mapping confidence score"),
    metadata: z.object({
      platformType: z.string(),
      sourceId: z.string(),
      eventTypes: z.array(z.string()),
      unmappedFields: z.array(z.string()).optional()
    })
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mappingId: z.string(),
    savedAt: z.string(),
    confidence: z.number(),
    fieldCount: z.number(),
    requiresReview: z.boolean()
  }),
  execute: async (inputData, context) => {
    const { tenantId, userId, interfaceId, templateId, mappings, confidence, metadata } = inputData;
    try {
      if (!tenantId || !userId || !interfaceId) {
        throw new Error("Missing required identifiers");
      }
      if (!mappings || Object.keys(mappings).length === 0) {
        throw new Error("No mappings provided");
      }
      const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const mappingRecord = {
        id: mappingId,
        tenantId,
        userId,
        interfaceId,
        templateId,
        mappings,
        confidence,
        metadata,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: confidence >= 0.8 ? "approved" : "pending_review"
      };
      console.log("Saving mapping:", JSON.stringify(mappingRecord, null, 2));
      const requiresReview = confidence < 0.7 || Boolean(metadata.unmappedFields && metadata.unmappedFields.length > 0);
      return {
        success: true,
        mappingId,
        savedAt: mappingRecord.createdAt,
        confidence,
        fieldCount: Object.keys(mappings).length,
        requiresReview
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save mapping: ${message}`);
    }
  }
});

export { saveMapping };
