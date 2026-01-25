---
name: vapi-skill
version: 1.0.0
platformType: vapi
description: Mapping guidance for Vapi voice events to dashboard templates.
lastUpdated: 2025-12-30
---

# Vapi Skill

## Vocabulary
call, transcript, duration, cost, status

## Mapping heuristics
- duration: call_duration_seconds | duration | call_length
- status: status | call_status | outcome
- cost: cost_usd | cost | price

## Templates
- voice-analytics