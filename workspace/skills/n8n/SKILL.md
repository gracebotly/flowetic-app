---
name: n8n
version: 1.1.0
platformType: n8n
description: Dashboard-first journey guidance for n8n. Use when a user connected n8n and wants a Workflow Activity Dashboard (default) with auto-mapping and live preview, and optionally to turn a workflow into a product.
lastUpdated: 2026-01-13
---

# n8n — Dashboard-First Skill (Workflow Activity Dashboard)

## Prime Directive (User Journey)
Your job is to get the agency user from **Connected n8n → Live preview dashboard** in minutes with low cognitive load:
1) Celebrate connection (no JSON)
2) Recommend **Workflow Activity Dashboard** by default
3) Auto-map fields silently (ask only when missing)
4) Show preview with real data
5) Offer optional "Turn a workflow into a product" next

For MVP, always start by selecting exactly one workflow that already has executions/events so the preview can be generated from real data immediately.

Never ask for UUIDs or show raw payloads unless user explicitly requests "raw".

---

## Step 1 — "Connected!" Success Copy (use in chat + UI-friendly wording)
When n8n is connected and you have events/executions, summarize like:

**🎉 n8n Connected**
- ✅ Workflows indexed
- ✅ Execution activity detected
- ✅ Ready to build your Workflow Activity Dashboard

**Detected signals (example phrasing):**
- execution status (success/failure)
- execution duration (runtime)
- workflow identifier/name (grouping)
- timestamps (trend charts)
- error messages (for troubleshooting)

Primary CTA language: **"Build Dashboard"**

---

## Step 2 — Default Template Choice
Default recommendation: **Workflow Activity Dashboard** (aka workflow monitoring / ops dashboard).

Choose this when the user says anything like:
- "monitor workflows", "activity dashboard", "failures", "reliability", "ops", "runs", "executions", "SLA", "debug", "what's breaking"

If the user asks for ROI: still start with Workflow Activity Dashboard, then add ROI widgets later (time saved, tasks automated estimates).

---

## Step 3 — Auto-Mapping (what fields to look for)
### Vocabulary
- workflow = automation definition
- execution = one run of a workflow
- node = a step inside a workflow
- trigger = how it starts (webhook/schedule/manual)
- status = outcome (success/error/waiting/running/crashed)

### Minimal required signals for the dashboard
Map these with highest priority:

1) **execution_status**
- n8n: `status`
- normalize:
  - `success` → `completed`
  - `error` / `crashed` → `failed`
  - `waiting` / `running` → `running`

2) **timestamp**
- prefer: `stoppedAt` for completed/failed executions
- fallback: `startedAt` if stoppedAt missing

3) **duration_ms**
- prefer: `duration` if present
- else: derive `(stoppedAt - startedAt)` in ms when both exist
- if still running: `now - startedAt` (optional)

### Strongly recommended (for grouping + filtering)
- **workflow_id**: `workflowId` (or workflow name if that's what you have)
- **trigger_type**: `mode` (webhook/manual/trigger)
- **execution_id**: `id`

---

## Step 4 — What to Show (widgets the user expects)
Use user-friendly labels:

- Total Executions (last 7d)
- Success Rate
- Failures (count)
- Avg Duration
- Executions Over Time (line chart)
- Recent Executions (table)
- Top Failing Workflows (bar list)
- Latest Errors (safe summaries)

If node-level data is available, offer optional drill-down: "slow node", "failed node" (don't assume it exists).

---

## Step 5 — "Confirm Field Mapping" UX Rules
- 90% should be auto-matched.
- Only interrupt the user when required fields are missing or ambiguous.
- If missing, present **2–3 suggested fields** (no manual typing first).

Ask in a UI-friendly way:
- "I can't find duration. I found: execution_time, runtime_ms, stopped_at-started_at. Which should we use?"

---

## Step 6 — Optional: Turn Into a Product (SaaS wrapper mode)
Only after dashboard preview is working, offer:

"Want to turn one of these workflows into a client-facing product (form → workflow → output), fully white-labeled?"

When user says yes:
- pick a single workflow
- define inputs (form fields)
- define output (success message, file, record created, webhook response)
- keep it branded and platform-hidden (do not mention n8n in client-facing copy)

---

## Common Data Signals in n8n (don't overwhelm the user)
- Execution reliability: success/failure, retries
- Performance: duration, slow runs
- Volume: runs per day/hour
- Errors: message, failed node (if available)
- Triggers: webhook/manual/schedule

For deeper details, read:
- `references/data-signals.md`
- `references/workflow-archetypes.md`
- `references/mapping-cheatsheet.md`

---

## What Not To Do
- Do not show raw JSON, schemas, UUIDs, or database details unless user asks.
- Do not assume node-level details exist (only use if present).
- Do not "invent" ROI numbers. If estimating time saved, label it as estimate and explain the assumption briefly.
- Do not break the dashboard-first flow by jumping to productization immediately unless user explicitly asks.
