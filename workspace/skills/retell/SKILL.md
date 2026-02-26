---
name: retell
version: 2.0.0
platformType: retell
description: Mapping guidance for Retell AI voice agent events. Covers call metrics, agent performance, disconnect reasons, and conversation analytics.
tags:
  - platform
  - retell
  - voice
  - analytics
metadata:
  author: getflowetic
  phase-scope: all
lastUpdated: 2026-02-25
---

# Retell Platform Skill

## Overview
Retell is a conversational AI platform for building voice agents. Users connect Retell agents to Getflowetic to monitor call quality, track agent performance, and analyze conversation patterns.

## Vocabulary
- **call**: A single voice interaction between a Retell agent and a caller
- **agent**: A configured Retell voice agent with an LLM backend and voice
- **call_status**: Call outcome — `ended` or `completed` (success) vs other (failure)
- **disconnect_reason**: Why the call ended (agent_hangup, user_hangup, error, silence, max_duration)
- **duration_ms**: Call length in milliseconds
- **start_timestamp / end_timestamp**: Unix timestamps for call timing

## Key Metrics for Dashboards
- **Call Volume**: Total calls over time — trend chart on started_at
- **Success Rate**: Percentage of calls with successful outcome — hero stat
- **Avg Duration**: Average call length in ms — supporting metric card
- **Agent Breakdown**: Calls per agent — pie chart on agent_name/workflow_name
- **Disconnect Reasons**: Why calls end — pie chart for quality monitoring

## Event Field Mapping
The Retell import route normalizes call data into the standard event schema. These are the fields that appear in `event.state`:

| Event Field | Semantic Type | Dashboard Use |
|-------------|--------------|--------------|
| workflow_id | identifier | Maps to agent_id — count only |
| workflow_name | dimension | Maps to agent_name — breakdown charts |
| execution_id | surrogate_key | Maps to call_id — "Total Calls" KPI |
| status | dimension | Success rate percentage — hero stat |
| duration_ms | measure (avg) | "Avg Call Duration" metric card |
| started_at | time_dimension | Timeseries trend axis |
| ended_at | time_dimension | Detail only |
| platform | constant | Always "retell" — skip |

These fields also appear in `event.labels`:
- agent_id, agent_name, call_id, status

## Dashboard Templates
- **voice-analytics**: Call volume trend, success rate, avg duration, agent breakdown
- **agent-performance**: Per-agent comparison, disconnect reasons, quality metrics
- **quality-monitor**: Disconnect reason trends, error rates, duration outliers

## Mapping Heuristics (Legacy Aliases)
- call_status → status
- agent_id → workflow_id
- agent_name → workflow_name
- call_id → execution_id
