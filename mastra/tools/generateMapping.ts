import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const generateMapping = createTool({
  id: 'generate-mapping',
  description: 'Maps platform event fields to dashboard template requirements',
  inputSchema: z.object({
    templateId: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
    platformType: z.string(),
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  execute: async (inputData: any, context: any) => {
    const { templateId, fields, platformType } = inputData;
    
    // Template requirements (simplified for MVP)
    const templateRequirements: Record<string, string[]> = {
      'voice-agent-dashboard': ['call_id', 'duration', 'status', 'transcript', 'cost'],
      'workflow-dashboard': ['workflow_id', 'status', 'started_at', 'ended_at'],
      'chat-dashboard': ['message_id', 'role', 'text', 'timestamp'],
      'multi-agent-dashboard': ['agent_id', 'task', 'status', 'output'],
      'default': ['id', 'timestamp', 'type'],
    };
    
    const required = templateRequirements[templateId] || templateRequirements['default'];
    const fieldNames = fields.map((f: any) => f.name.toLowerCase());
    
    const mappings: Record<string, string> = {};
    const missingFields: string[] = [];
    
    // Simple fuzzy matching
    required.forEach(reqField => {
      const normalized = reqField.toLowerCase().replace(/_/g, '');
      
      // Exact match
      let found = fieldNames.find((f: any) => f === reqField);
      
      // Fuzzy match (remove underscores, check contains)
      if (!found) {
        found = fieldNames.find((f: any) => 
          f.replace(/_/g, '').includes(normalized) ||
          normalized.includes(f.replace(/_/g, ''))
        );
      }
      
      if (found) {
        mappings[reqField] = found;
      } else {
        missingFields.push(reqField);
      }
    });
    
    const confidence = (Object.keys(mappings).length / required.length);
    
    return {
      mappings,
      missingFields,
      confidence,
    };
  },
});
