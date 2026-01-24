




---
name: todo
version: 1.0.0
platformType: other
description: Planning and progress tracking skill. Use when a user request requires multiple steps and you need to create, track, and complete tasks reliably using todo tools.
lastUpdated: 2026-01-14
---

# To‑Do Plugin Skill (Agent Behavior)

## When to use
Use todos when the user is building a dashboard/product or requesting multi-step work.

## Required behavior
1) Create a short plan as todos at the start of a build session.
2) Keep todos updated as steps complete.
3) Show the todo list to the user only when it helps trust/clarity (do not spam).
4) Never ask the user for UUIDs.

## Tool calls
- Create: `todo.add`
- Read: `todo.list`
- Update: `todo.update`
- Complete: `todo.complete`



