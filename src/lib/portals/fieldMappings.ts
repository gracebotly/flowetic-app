/**
 * Field Mappings — Platform → Dashboard Data Keys
 * 
 * Each platform stores data in event.state with slightly different keys.
 * These mappings tell skeleton components where to find each metric.
 * 
 * SOURCE OF TRUTH for field names:
 * - Vapi:   src/app/api/connections/inventory/vapi/import/route.ts
 * - Retell: src/app/api/connections/inventory/retell/import/route.ts  
 * - n8n:    src/app/api/connections/inventory/n8n/import/route.ts
 * - Make:   src/app/api/connections/inventory/make/import/route.ts
 */

export interface VoiceFieldMapping {
  // Identifiers
  callId: string;
  assistantId: string;
  assistantName: string;
  
  // Metrics
  status: string;
  statusSuccessValue: string;
  durationMs: string;
  cost: string;
  
  // Time
  startedAt: string;
  endedAt: string;
  
  // Rich fields (from Vapi/Retell API data)
  endedReason: string;
  callType: string;         // inbound/outbound/web
  sentiment: string;        // Retell: user_sentiment
  callSummary: string;      // analysis.summary
  callSuccessful: string;   // analysis.successEvaluation / call_successful
  transcript: string;       // artifact.transcript
  
  // Cost breakdown
  costBreakdown: string;    // Vapi: costBreakdown object
}

export interface WorkflowFieldMapping {
  // Identifiers
  executionId: string;
  workflowId: string;
  workflowName: string;
  
  // Metrics
  status: string;
  statusSuccessValue: string;
  durationMs: string;
  
  // Time
  startedAt: string;
  endedAt: string;
  
  // Rich fields
  errorMessage: string;
  nodeCount: string;        // n8n: number of nodes executed
  operationsUsed: string;   // Make: operations consumed
  triggerType: string;       // webhook/schedule/manual
}

// ─── Vapi Field Mapping ──────────────────────────────────────
// Source: Vapi List Calls API → normalized by import route
// API fields available: id, type (inboundPhoneCall/outboundPhoneCall/webCall),
//   status, endedReason, startedAt, endedAt, cost, costBreakdown {transport, stt, llm, tts, vapi, total},
//   analysis {summary, successEvaluation, structuredData},
//   artifact {transcript, messages[], recordingUrl},
//   assistantId, assistant.name
export const VAPI_FIELDS: VoiceFieldMapping = {
  callId:             'execution_id',     // call.id → execution_id in state
  assistantId:        'workflow_id',      // call.assistantId → workflow_id
  assistantName:      'workflow_name',    // call.assistant.name → workflow_name
  status:             'status',           // 'success' if call.status === 'ended'
  statusSuccessValue: 'success',
  durationMs:         'duration_ms',      // endedAt - startedAt in ms
  cost:               'cost',             // call.cost (USD float)
  startedAt:          'started_at',       // call.startedAt
  endedAt:            'ended_at',         // call.endedAt
  endedReason:        'ended_reason',     // call.endedReason (customer-ended-call, assistant-ended-call, etc.)
  callType:           'call_type',        // call.type (inboundPhoneCall, outboundPhoneCall, webCall)
  sentiment:          'sentiment',        // from analysis.structuredData if configured
  callSummary:        'call_summary',     // call.analysis.summary
  callSuccessful:     'call_successful',  // call.analysis.successEvaluation
  transcript:         'transcript',       // call.artifact.transcript
  costBreakdown:      'cost_breakdown',   // call.costBreakdown {transport, stt, llm, tts, vapi, total}
};

// ─── Retell Field Mapping ────────────────────────────────────
// Source: Retell List Calls API → normalized by import route
// API fields available: call_id, call_type (web_call/phone_call), 
//   agent_id, call_status, start_timestamp, end_timestamp,
//   disconnection_reason, call_analysis {call_summary, in_voicemail, user_sentiment, 
//     call_successful, custom_analysis_data},
//   call_cost {product_costs[], total_duration_seconds, combined_cost},
//   transcript, recording_url
export const RETELL_FIELDS: VoiceFieldMapping = {
  callId:             'execution_id',
  assistantId:        'workflow_id',      // agent_id
  assistantName:      'workflow_name',    // agent name
  status:             'status',
  statusSuccessValue: 'success',
  durationMs:         'duration_ms',
  cost:               'cost',             // call_cost.combined_cost
  startedAt:          'started_at',
  endedAt:            'ended_at',
  endedReason:        'ended_reason',     // disconnection_reason
  callType:           'call_type',        // web_call / phone_call
  sentiment:          'user_sentiment',   // call_analysis.user_sentiment (Positive/Negative/Neutral)
  callSummary:        'call_summary',     // call_analysis.call_summary
  callSuccessful:     'call_successful',  // call_analysis.call_successful (boolean)
  transcript:         'transcript',
  costBreakdown:      'cost_breakdown',   // call_cost.product_costs[]
};

// ─── n8n Field Mapping ───────────────────────────────────────
// Source: n8n Executions API → normalized by import route
// API fields: id, status (success/error/crashed/waiting), 
//   startedAt, stoppedAt, workflowId, workflowData.name,
//   data.resultData (node outputs), data.resultData.error
export const N8N_FIELDS: WorkflowFieldMapping = {
  executionId:        'execution_id',
  workflowId:         'workflow_id',
  workflowName:       'workflow_name',
  status:             'status',
  statusSuccessValue: 'success',
  durationMs:         'duration_ms',      // stoppedAt - startedAt
  startedAt:          'started_at',
  endedAt:            'ended_at',
  errorMessage:       'error_message',    // data.resultData.error.message
  nodeCount:          'node_count',       // count of executed nodes
  operationsUsed:     'operations_used',  // not applicable for n8n
  triggerType:        'trigger_type',     // webhook/schedule/manual
};

// ─── Make Field Mapping ──────────────────────────────────────
// Source: Make Executions API → normalized by import route
// API fields: id, status, statusLabel, duration, 
//   operations, organizationId, scenarioId
export const MAKE_FIELDS: WorkflowFieldMapping = {
  executionId:        'execution_id',
  workflowId:         'workflow_id',      // scenarioId
  workflowName:       'workflow_name',    // scenario name
  status:             'status',
  statusSuccessValue: 'success',
  durationMs:         'duration_ms',
  startedAt:          'started_at',
  endedAt:            'ended_at',
  errorMessage:       'error_message',
  nodeCount:          'node_count',       // modules count
  operationsUsed:     'operations_used',  // Make operations consumed
  triggerType:        'trigger_type',
};

// ─── Lookup ──────────────────────────────────────────────────

export function getVoiceFieldMapping(platform: string): VoiceFieldMapping {
  switch (platform) {
    case 'vapi':   return VAPI_FIELDS;
    case 'retell': return RETELL_FIELDS;
    default:       return VAPI_FIELDS;
  }
}

export function getWorkflowFieldMapping(platform: string): WorkflowFieldMapping {
  switch (platform) {
    case 'n8n':  return N8N_FIELDS;
    case 'make': return MAKE_FIELDS;
    default:     return N8N_FIELDS;
  }
}
