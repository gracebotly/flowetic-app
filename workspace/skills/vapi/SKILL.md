---
name: vapi
version: 2.0.0
platformType: vapi
description: Mapping guidance for Vapi voice AI events. Covers call metrics, assistant performance, cost tracking, and transcript handling. Use for any Vapi-connected dashboard generation or editing task.
tags:
  - platform
  - vapi
  - voice
  - analytics
metadata:
  author: getflowetic
  phase-scope: all
lastUpdated: 2026-02-25
---

# Vapi Platform Skill

## Overview
Vapi is a voice AI platform for building phone agents. Users connect Vapi assistants to Getflowetic to monitor call performance, track costs, and analyze conversation outcomes.

## Vocabulary
- **call**: A single voice interaction between an assistant and a caller
- **assistant**: A configured Vapi voice agent with a system prompt, model, and voice
- **ended_reason**: Why the call terminated (hangup, voicemail, error, silence-timeout, max-duration)
- **cost**: Per-call cost in USD based on duration + model usage
- **transcript**: Full text of the conversation
- **status**: Call outcome — `ended` (success) or other values (failure)

## Key Metrics for Dashboards
- **Call Volume**: Total calls over time — trend chart on started_at
- **Success Rate**: Percentage of calls with status=success — hero stat
- **Avg Duration**: Average call length in ms — supporting metric card
- **Cost per Call**: Total cost divided by call count — supporting metric
- **Assistant Breakdown**: Calls per assistant — pie chart on assistant_name/workflow_name

## Event Field Mapping
The Vapi import route normalizes call data into the standard event schema. These are the fields that appear in `event.state`:

| Event Field | Semantic Type | Dashboard Use |
|-------------|--------------|--------------|
| workflow_id | identifier | Maps to assistant_id — count only |
| workflow_name | dimension | Maps to assistant name — breakdown charts |
| execution_id | surrogate_key | Maps to call_id — "Total Calls" KPI |
| status | dimension | Success rate percentage — hero stat |
| duration_ms | measure (avg) | "Avg Call Duration" metric card |
| started_at | time_dimension | Timeseries trend axis |
| ended_at | time_dimension | Detail only |
| platform | constant | Always "vapi" — skip |

These fields also appear in `event.labels`:
- assistant_id, assistant_name, call_id, status

## Dashboard Templates
- **voice-analytics**: Call volume trend, success rate, avg duration, assistant breakdown
- **assistant-performance**: Per-assistant comparison with call counts and durations
- **cost-tracker**: Cost trends over time, cost per call, total spend

## Mapping Heuristics (Legacy Aliases)
These field name variations should resolve to the canonical names above:
- duration: call_duration_seconds | duration | call_length → duration_ms
- status: status | call_status | outcome → status
- cost: cost_usd | cost | price → cost
