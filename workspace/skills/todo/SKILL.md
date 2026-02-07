---
name: todo
version: 1.0.0
platformType: other
description: Planning and progress tracking skill for agent's internal reasoning. Use when an agent needs to create, track, and complete tasks across its own multi-step operations and maintain state persistence.
lastUpdated: 2026-01-30
---

# To-Do Plugin Skill (Agent Internal Reasoning)

## When to use

Use todos for agent's **internal reasoning and state persistence** during multi-step work that requires tracking state across operations. Todos are NOT for UI progress indicators or simple user choices.

**DO create todos for:**
- "Plan dashboard journey" (session start, masterRouterAgent - internal planning state)
- "Generate preview dashboard" (Phase 4, dashboardBuilderAgent - internal multi-step workflow)
- "Apply interactive edits" (Phase 5, dashboardBuilderAgent - internal iterative process)
- "Deploy dashboard" (Phase 6, masterRouterAgent - internal deployment verification)

**DO NOT create todos for:**
- UI card selections (outcome selection, storyboard selection, style bundle selection)
- Atomic tool calls (RAG queries, schema analysis, spec validation)
- Workflow execution (connectionBackfill, generatePreview - workflows track themselves)
- Phase state transitions alone
- Simple confirmations or quick questions

## Required behavior

1) Create todos for internal state tracking at appropriate times:
   - Session start: create 1–3 high-level todos for planning
   - Multi-step work start: create todo for the work item
   - Mark todos complete when the internal state change is complete

2) Use todos to maintain your reasoning state across steps:
   - The todo list helps you remember what you're working on
   - Marking complete lets you track progress within your own logic
   - This is for YOUR internal use, not for displaying to users

3) Never create todos for simple UI choices or atomic operations:
   - Card selections are state transitions, not work items
   - Single tool calls don't need tracking
   - Let workflows handle their own internal state

4) Keep todo list focused on meaningful multi-step work:
   - Each todo should represent actual work requiring multiple steps
   - If it's one action, it doesn't need a todo
   - Quality over quantity - fewer, meaningful todos are better

## Tool calls

- Create: `todo.add`
- Read: `todo.list`
- Update: `todo.update`
- Complete: `todo.complete`

## Minimal workflow

- On meaningful multi-step work start: create a todo for that work
- After internal state change completes: mark the matching todo complete
- Use todo.list to review your active work items
- Never create todos for simple UI choices or atomic operations

## Remember

This todo system is for **your agent's internal reasoning and state persistence**. It helps you track what you're working on across multiple steps and maintain context. It is NOT a UI progress indicator or a way to show users what you've done.
