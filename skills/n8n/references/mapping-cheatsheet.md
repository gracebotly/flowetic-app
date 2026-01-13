
# n8n Mapping Cheatsheet (Reference)

Use this only when implementing or debugging mapping.

## Field priorities for Workflow Activity Dashboard
- execution_status: execution.status (normalize)
- timestamp: stoppedAt preferred, else startedAt
- duration_ms: duration else (stoppedAt-startedAt)
- workflow_id: workflowId
- execution_id: id
- trigger_type: mode

## Status normalization
- success -> completed
- error, crashed -> failed
- waiting, running -> running

## Retry handling (if present)
- retryOf: indicates this execution is a retry attempt
- retrySuccessId: indicates a retry eventually succeeded elsewhere
Rule of thumb for dashboard counting:
- Prefer counting final outcome executions when possible
- Track retry rate separately if you have both retryOf + retrySuccessId

## Safety rules
- Never expose secrets from payloads
- Never show raw payload unless user explicitly asks "raw data"
- If fields are missing, ask user with 2–3 candidates (no freeform typing first)


