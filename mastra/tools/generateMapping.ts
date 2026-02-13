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
  execute: async (inputData, context) => {
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

    // ================================================================
    // SEMANTIC ALIAS MAP: Maps template-required fields to likely
    // field names that appear in real platform data.
    // This is why the old code failed — it only did naive substring
    // matching, and "threadId" never matched "workflow_id".
    // ================================================================
    const semanticAliases: Record<string, string[]> = {
      // workflow-dashboard fields
      'workflow_id': ['threadid', 'thread_id', 'runid', 'run_id', 'executionid', 'execution_id', 'id', 'sourceid', 'source_id'],
      'status': ['kind', 'state', 'status', 'result', 'outcome', 'execution_status'],
      'started_at': ['started_at', 'startedAt', 'start_time', 'startTime', 'created_at', 'createdAt', 'timestamp', 'start'],
      'ended_at': ['ended_at', 'endedAt', 'end_time', 'endTime', 'finished_at', 'finishedAt', 'completed_at', 'completedAt', 'stoppedAt', 'stopped_at', 'end'],
      // voice-agent-dashboard fields
      'call_id': ['threadid', 'thread_id', 'callid', 'call_id', 'id', 'sessionid', 'session_id'],
      'duration': ['duration', 'call_duration', 'length', 'elapsed', 'duration_seconds', 'call_duration_seconds', 'call_length'],
      'transcript': ['text', 'content', 'message', 'transcript', 'body'],
      'cost': ['cost', 'price', 'amount', 'charge', 'total_cost'],
      // chat-dashboard fields
      'message_id': ['id', 'threadid', 'thread_id', 'messageid', 'message_id'],
      'role': ['kind', 'role', 'type', 'sender', 'author'],
      'text': ['text', 'content', 'message', 'body'],
      'timestamp': ['createdat', 'created_at', 'timestamp', 'time', 'date', 'event_time'],
      // multi-agent-dashboard fields
      'agent_id': ['agentid', 'agent_id', 'sourceid', 'source_id'],
      'task': ['kind', 'task', 'type', 'action', 'job'],
      'output': ['text', 'output', 'result', 'response', 'content'],
      // default fields
      'id': ['id', 'threadid', 'thread_id', 'runid', 'sourceid'],
      'type': ['kind', 'type', 'event_type', 'category'],
    };

    const fieldNamesLower = fields.map(f => f.name.toLowerCase().replace(/_/g, ''));
    const fieldNamesOriginal = fields.map(f => f.name);

    const mappings: Record<string, string> = {};
    const missingFields: string[] = [];

    required.forEach(reqField => {
      const aliases = semanticAliases[reqField] || [reqField.toLowerCase().replace(/_/g, '')];
      let foundIndex = -1;

      // 1. Try exact match (case-insensitive)
      foundIndex = fieldNamesLower.findIndex(f => f === reqField.toLowerCase().replace(/_/g, ''));

      // 2. Try alias match
      if (foundIndex === -1) {
        for (const alias of aliases) {
          const normalizedAlias = alias.toLowerCase().replace(/_/g, '');
          foundIndex = fieldNamesLower.findIndex(f => f === normalizedAlias);
          if (foundIndex !== -1) break;
        }
      }

      // 3. Try contains match as last resort
      if (foundIndex === -1) {
        const normalized = reqField.toLowerCase().replace(/_/g, '');
        foundIndex = fieldNamesLower.findIndex(f =>
          f.includes(normalized) || normalized.includes(f)
        );
      }

      if (foundIndex !== -1) {
        mappings[reqField] = fieldNamesOriginal[foundIndex];
      } else {
        missingFields.push(reqField);
      }
    });

    const confidence = required.length > 0
      ? Object.keys(mappings).length / required.length
      : 1;

    return {
      mappings,
      missingFields,
      confidence,
    };
  },
});
