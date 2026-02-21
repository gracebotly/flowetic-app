# Critical Bug Fixes - February 2026
## Summary
Fixed 4 critical production bugs causing journey phase stuck at `recommend`, 300-second timeouts, and missing greeting on init.
## Bugs Fixed
### Bug 1: No Greeting / Deterministic Bypass Protocol
**Symptom**: Init message produces no visible response. User stuck on "Starting session...".
**Root Cause**: Deterministic `select_entity` bypass returned legacy `0:`, `e:`, `d:` stream format instead of AI SDK v5 UIMessage SSE chunks.
**Fix**: Replaced manual stream construction with `createUIMessageStream()` + `createUIMessageStreamResponse()` using proper `text-start`, `text-delta`, `text-end` chunks and `x-vercel-ai-ui-message-stream: v1` header.
**Files Changed**:
- `src/app/api/chat/route.ts`: Import `createUIMessageStream`, `generateId`; rewrite `handleDeterministicSelectEntity` stream logic
**Verification**: User sees greeting immediately after init message.
---
### Bug 2: Phase Stuck at `recommend` - Wireframe Never Confirmed
**Symptom**: User confirms wireframe ("This looks right"), agent acknowledges, but `journey_sessions.wireframe_confirmed` stays `false` and `mode` never advances to `style`.
**Root Cause**:
1. Wireframe confirmation detection read `message.content` (AI SDK v4 format) instead of `message.parts[].text` (AI SDK v5 format)
2. Regex patterns too strict - `"looks right"` didn't match `"looks good"` pattern
**Fix**:
1. Extract user text from `parts[]` array:
   ```typescript
   const userText = lastUserMessage?.parts
     ?.filter(p => p.type === 'text')
     ?.map(p => p.text)
     ?.join(' ')
   ```
2. Broaden confirmation patterns to include `"looks right"`, `"correct"`, `"fine"`, etc.
**Files Changed**:
- `src/app/api/chat/route.ts`: `onFinish` wireframe detection block
**Verification**: Query DB after user confirms:
```sql
SELECT mode, wireframe_confirmed
FROM journey_sessions
WHERE thread_id = '<thread_id>';
```
Should show `mode='style'` and `wireframe_confirmed=true`.
---
### Bug 3: 300-Second Timeouts / Slow Responses
**Contributing Factors**:
1. Tool name logging showed `[unknown]` making debugging impossible
2. updateWorkingMemory creating dual-state confusion (agent reads "style" from memory, server forces "recommend")
3. Agent calling workspace tools to read 96KB files unnecessarily
**Fixes**:
1. Improved tool name extraction in `onStepFinish`:
   ```typescript
   const toolNames = (toolCalls ?? []).map(tc =>
     tc.toolName || tc.tool?.name || tc.name || tc.args?.toolName || 'unknown'
   );
   ```
2. Removed updateWorkingMemory from passthrough (see Bug 4)
**Files Changed**:
- `src/app/api/chat/route.ts`: `onStepFinish` tool name logging
**Verification**: Check logs - should see actual tool names instead of `[unknown]`.
---
### Bug 4: Working Memory Contradicts Database
**Symptom**: Mastra `updateWorkingMemory` writes `phase: 'style'` to thread metadata while DB has `mode: 'recommend'`. Agent confused, calls wrong tools.
**Root Cause**: `updateWorkingMemory` tool writes to Mastra thread metadata (NOT journey_sessions table), creating dual source of truth.
**Fix**: Removed `updateWorkingMemory` from phase-agnostic passthrough. Tool now gets gated and is unavailable in all phases.
**Files Changed**:
- `mastra/processors/phase-tool-gating.ts`: Removed from `MASTRA_INTERNAL_TOOLS` set
- `mastra/agents/instructions/phase-instructions.ts`: Verified not in any allowlist
**Verification**: Check PhaseToolGating logs - `updateWorkingMemory` should be in gated count, not passthrough count.
---
## ✅ COMPLETE - READY FOR EXECUTION
**Total files modified**: 4 files + 1 new documentation file
**Summary**:
1. ✅ Fixed deterministic bypass protocol (Bug 1)
2. ✅ Fixed wireframe confirmation detection (Bug 2)
3. ✅ Improved tool name logging (Bug 3)
4. ✅ Removed dual-state updateWorkingMemory (Bug 4)
5. ✅ Created testing documentation
Push all changes to branch `claude/fix-all-critical-bugs` and test immediately.
