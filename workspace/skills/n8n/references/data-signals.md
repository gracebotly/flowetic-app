# n8n Data Signals (Reference)

Use this file only when you need more detail about what can be measured from n8n-connected activity.

## Core signals (almost always available from executions)
- Execution status: success / error / waiting / running / crashed
- Execution timestamps: startedAt, stoppedAt
- Duration: either explicit duration or derived from timestamps
- Workflow identifier: workflowId, workflow name (if available)
- Trigger/mode: manual/webhook/trigger/schedule (varies by setup)

## Ops / Monitoring signals (dashboard-first)
- Reliability: success rate, failure rate, failure streaks
- Performance: avg duration, p95 duration (if enough data)
- Throughput: executions per hour/day
- Hotspots: "top failing workflows", "slowest workflows"

## AI-agent style workflows (when present)
Some users run "AI agent" workflows inside n8n using LLM nodes or HTTP calls to AI providers.
Possible measurable signals (only if you ingest/log them):
- Model name (if recorded in node output)
- Token usage / cost (only if your workflow emits it)
- AI step latency (node runtime)
Do not assume these fields exist; offer them as optional enhancements.

## Webhook-centric workflows
Webhook trigger workflows support product-style patterns:
- inbound requests (form submits, API calls)
- outbound responses (success message, created record, generated artifact)
For SaaS wrapper mode, focus on:
- number of submissions (runs)
- outcomes (success/fail)
- time-to-result (duration)
- latest errors (safe summary)

## Node-level detail (only if available)
If execution payloads include node run data, possible extras:
- failed_node_name / failed_node_id
- per-node executionTime
- lastNodeExecuted
Treat node-level signals as optional drill-down, never required for the default dashboard.
