

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

**n8n Connected**
- Workflows indexed
- Execution activity detected
- Ready to build your Workflow Activity Dashboard

Primary CTA language: **"Build Dashboard"**

