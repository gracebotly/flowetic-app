import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const generateMapping = createTool({
  id: 'generateMapping',
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
  execute: async (inputData, context) => {
    const { templateId, fields, platformType } = inputData;

    // Template requirements (simplified for MVP)
    const templateRequirements: Record<string, string[]> = {
      'workflow-dashboard': ['workflow_id', 'status', 'started_at', 'ended_at', 'duration_ms'],
      'workflow-monitor': ['workflow_id', 'status', 'started_at', 'ended_at', 'duration_ms'],
      'voice-agent-dashboard': ['call_id', 'duration', 'status', 'transcript', 'cost'],
      'voice-analytics': ['call_id', 'duration', 'status'],
      'chat-dashboard': ['message_id', 'role', 'text', 'timestamp'],
      'multi-agent-dashboard': ['agent_id', 'task', 'status', 'output'],
      'general-analytics': ['timestamp', 'status'],
      'default': ['id', 'timestamp', 'type'],
    };

    const required = templateRequirements[templateId] || templateRequirements['default'];

    // ================================================================
    // SEMANTIC ALIAS MAP: Maps template-required fields to actual
    // field names that appear in normalized platform data.
    // ================================================================
    const semanticAliases: Record<string, string[]> = {
      // Workflow/Execution identifiers
      'workflow_id': [
        'workflow_id',
        'workflowId',
        'workflow_name',
        'workflowName',
        'flow_id',
        'flowId',
        'automation_id',
        'process_id',
      ],
      'execution_id': [
        'execution_id',
        'executionId',
        'run_id',
        'runId',
        'id',
        'execution',
      ],

      // Status fields
      'status': [
        'status',
        'state',
        'execution_status',
        'executionStatus',
        'result',
        'outcome',
        'success',
        'finished',
      ],

      // Timestamps
      'started_at': [
        'started_at',
        'startedAt',
        'start_time',
        'startTime',
        'created_at',
        'createdAt',
        'timestamp',
      ],
      'ended_at': [
        'ended_at',
        'endedAt',
        'finished_at',
        'finishedAt',
        'stopped_at',
        'stoppedAt',
        'completed_at',
        'completedAt',
        'end_time',
        'endTime',
      ],

      // Duration
      'duration_ms': [
        'duration_ms',
        'durationMs',
        'duration',
        'elapsed_time',
        'elapsedTime',
        'execution_time',
        'executionTime',
        'runtime',
        'run_time',
      ],

      // Error fields
      'error_message': [
        'error_message',
        'errorMessage',
        'error',
        'error_text',
        'failure_reason',
        'failureReason',
      ],

      // Voice agent fields
      'call_id': [
        'call_id',
        'callId',
        'session_id',
        'sessionId',
        'conversation_id',
      ],
      'transcript': [
        'transcript',
        'conversation',
        'messages',
        'text',
      ],
      'cost': [
        'cost',
        'price',
        'amount',
        'total_cost',
      ],

      // Chat fields
      'message_id': [
        'message_id',
        'messageId',
        'id',
        'msg_id',
      ],
      'role': [
        'role',
        'sender',
        'author',
        'user_type',
      ],
      'text': [
        'text',
        'content',
        'message',
        'body',
      ],

      // General
      'timestamp': [
        'timestamp',
        'created_at',
        'createdAt',
        'time',
        'date',
      ],
      'platform': [
        'platform',
        'source',
        'provider',
        'service',
      ],
    };

    // ================================================================
    // MAPPING LOGIC: Match detected fields to required template fields
    // ================================================================
    const mappings: Record<string, string> = {};
    const missingFields: string[] = [];
    const fieldNames = new Set(fields.map(f => f.name.toLowerCase()));

    // Try to map each required field
    for (const requiredField of required) {
      const aliases = semanticAliases[requiredField] || [requiredField];
      let matched = false;

      // Check each alias (case-insensitive)
      for (const alias of aliases) {
        const aliasLower = alias.toLowerCase();

        // Exact match
        if (fieldNames.has(aliasLower)) {
          // Find the original case field name
          const originalField = fields.find(f => f.name.toLowerCase() === aliasLower);
          if (originalField) {
            mappings[requiredField] = originalField.name;
            matched = true;
            break;
          }
        }

        // Substring match (last resort)
        if (!matched) {
          for (const fieldName of fieldNames) {
            if (fieldName.includes(aliasLower) || aliasLower.includes(fieldName)) {
              const originalField = fields.find(f => f.name.toLowerCase() === fieldName);
              if (originalField) {
                mappings[requiredField] = originalField.name;
                matched = true;
                break;
              }
            }
          }
        }

        if (matched) break;
      }

      if (!matched) {
        missingFields.push(requiredField);
      }
    }

    // Calculate confidence based on mapping success
    const mappedCount = Object.keys(mappings).length;
    const requiredCount = required.length;
    const confidence = requiredCount > 0 ? mappedCount / requiredCount : 0;

    console.log('[generateMapping] Mapping complete:', {
      templateId,
      platformType,
      requiredFields: required,
      detectedFields: fields.map(f => f.name),
      mappings,
      missingFields,
      confidence,
    });

    return {
      mappings,
      missingFields,
      confidence,
    };
  },
});
