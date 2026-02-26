---
name: make
version: 2.0.0
platformType: make
description: Mapping guidance for Make.com (Integromat) scenario events. Covers execution metrics, scenario performance, operation counts, and module analytics.
tags:
  - platform
  - make
  - automation
  - analytics
metadata:
  author: getflowetic
  phase-scope: all
lastUpdated: 2026-02-25
---

# Make Platform Skill

## Overview
Make.com (formerly Integromat) is a visual automation platform for connecting apps and automating workflows via scenarios. Users connect Make scenarios to Getflowetic to monitor execution performance, track operation usage, and analyze error patterns.

## Vocabulary
- **scenario**: A Make automation workflow composed of modules connected in a flow
- **execution**: A single run of a scenario, triggered by schedule, webhook, or manual
- **module**: A single step/action within a scenario (e.g., HTTP request, Google Sheets row)
- **operation**: A billable action counted by Make — modules consume operations per execution
- **blueprint**: The JSON definition of a scenario's structure (modules + connections)
- **team**: Make organizational unit that owns scenarios and connections

## Key Metrics for Dashboards
- **Execution Volume**: Total runs over time — trend chart on started_at
- **Success Rate**: Percentage of executions with status=success — hero stat
- **Avg Duration**: Average execution time in ms — supporting metric card
- **Scenario Breakdown**: Runs per scenario — pie chart on scenario_name/workflow_name
- **Error Rate**: Failed executions as percentage — hero stat (inverted success)

## Event Field Mapping
The Make import route normalizes execution data into the standard event schema. These are the fields that appear in `event.state`:

| Event Field | Semantic Type | Dashboard Use |
|-------------|--------------|--------------|
| workflow_id | identifier | Maps to scenario_id — count only |
| workflow_name | dimension | Maps to scenario name — breakdown charts |
| execution_id | surrogate_key | Maps to execution ID — "Total Runs" KPI |
| status | dimension | Success rate percentage — hero stat |
| duration_ms | measure (avg) | "Avg Duration" metric card |
| started_at | time_dimension | Timeseries trend axis |
| ended_at | time_dimension | Detail only |
| platform | constant | Always "make" — skip |

These fields also appear in `event.labels`:
- scenario_id, scenario_name, execution_id, status, platformType

## Dashboard Templates
- **ops-monitoring**: Execution volume trend, success rate, avg duration, scenario breakdown
- **scenario-performance**: Per-scenario comparison with execution counts and durations
- **error-tracker**: Error trends, failure reasons, scenario-level error rates

## Mapping Heuristics (Legacy Aliases)
- scenario_id → workflow_id
- scenario_name → workflow_name
