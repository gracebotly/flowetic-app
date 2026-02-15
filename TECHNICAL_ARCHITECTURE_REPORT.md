# Flowetic App - Technical Architecture Report
## Context for Deep Research & Debugging

**Generated:** 2026-02-15
**Purpose:** Comprehensive technical context for debugging the 7 critical bugs in the design system, event tracking, and data pipeline

---

## Executive Summary

Flowetic is a Next.js application that generates customized dashboards for workflow automation platforms (n8n, Make, Vapi, etc.) using an AI-driven journey system. The app uses Mastra for agent orchestration, Supabase for persistence, and the AI SDK v5 for streaming tool calls.

**Critical Architecture Components:**
- **Frontend:** Next.js 16.1.1 + React 19 + AI SDK 5.0.0
- **Agent Framework:** Mastra 1.1.0 (core) + 1.0.3 (ai-sdk)
- **Database:** Supabase (PostgreSQL with RLS)
- **AI Models:** Anthropic (Claude), OpenAI, Google via AI SDK providers

---

## 1. Dependency Versions

### Core Framework
```json
{
  "next": "16.1.1",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "ai": "5.0.0"
}
```

### Mastra Ecosystem (Pinned via overrides)
```json
{
  "@mastra/core": "1.1.0",
  "@mastra/ai-sdk": "1.0.3",
  "@mastra/pg": "1.1.0",
  "@mastra/libsql": "1.1.0",
  "@mastra/memory": "1.0.1",
  "@mastra/rag": "1.1.0",
  "@mastra/mcp": "1.0.0"
}
```

**Why Overrides?**
The `overrides` section forces all transitive dependencies to use exact Mastra versions to prevent "private field brand check" errors when multiple versions exist in the dependency tree.

### AI Providers
```json
{
  "@ai-sdk/anthropic": "2.0.0",
  "@ai-sdk/openai": "2.0.0",
  "@ai-sdk/google": "2.0.0",
  "@ai-sdk/react": "2.0.39"
}
```

### RxJS Version Lock
```json
{
  "rxjs": "7.8.1"  // Locked via resolutions AND overrides
}
```

**Critical:** Mastra requires RxJS 7.8.1 exactly. Newer versions break internal stream handling.

---

## 2. Mastra Architecture

### 2.1 Singleton Pattern

**File:** `mastra/index.ts`

```typescript
globalThis.__mastra = globalThis.__mastra ?? createMastraInstance();
export const mastra = globalThis.__mastra;
```

**Why?**
Turbopack/webpack can create multiple module copies in different chunks. Without the singleton pattern, you get "private field #workflows not found" errors because each instance has different class brands.

### 2.2 Registered Agents

1. **masterRouterAgent** - Top-level routing and phase management
2. **designAdvisorAgent** - Design system generation (uses ui-ux-pro-max skill)
3. **platformMappingMaster** - Maps platform events to dashboard schema
4. **dashboardBuilderAgent** - Generates UI specs

**Location:** `mastra/agents/`

### 2.3 Workflows

1. **designSystemWorkflow** - Generates single design system via designAdvisorAgent
2. **vibeJourneyWorkflow** - Orchestrates the full journey (select → recommend → style → build → edit → deploy)
3. **generatePreviewWorkflow** - Creates dashboard spec from schema
4. **deployDashboardWorkflow** - Deploys finalized dashboards
5. **connectionBackfillWorkflow** - Backfills platform connection data

**Location:** `mastra/workflows/`

### 2.4 Workspace & Skills System

**File:** `mastra/workspace/index.ts`

```typescript
export const workspace = new Workspace({
  id: 'flowetic-workspace',
  filesystem: new LocalFilesystem({
    basePath: path.join(process.cwd(), 'workspace'),
    readOnly: true  // Vercel-safe
  }),
  skills: ['/skills'],
  bm25: true  // Enables semantic skill search
});
```

**Skills Discovery:**
Skills are automatically discovered from `workspace/skills/` by Mastra. Each skill has a `SKILL.md` file.

**Available Skills:**
- `ui-ux-pro-max` - Design system recommendations (used by designAdvisorAgent)
- `business-outcomes-advisor` - Business outcome recommendations
- `retell` - Retell AI platform integration
- `vapi` - Vapi voice agent platform
- `n8n` - n8n workflow automation
- `make` - Make.com automation
- `activepieces` - ActivePieces automation
- `todo` - Todo management

**Skill Loading:**
Agents specify skills in their config. When `agent.generate()` is called, Mastra loads the skill's SKILL.md into context.

---

## 3. Database Schema (Supabase)

### 3.1 Key Tables

#### `journey_sessions`
Tracks the user's journey through the dashboard creation phases.

```sql
CREATE TABLE journey_sessions (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  thread_id UUID,  -- AI SDK thread ID
  mastra_thread_id UUID,  -- Mastra's internal thread ID
  mode TEXT,  -- Current phase: select_entity | recommend | style | build_preview | interactive_edit | deploy
  selected_outcome TEXT,  -- E.g., "dashboard" or "product"
  selected_style_bundle_id TEXT,  -- ⚠️ BUG 7: Stores display name instead of token key
  preview_interface_id UUID REFERENCES interfaces(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `interfaces`
Represents a dashboard interface.

```sql
CREATE TABLE interfaces (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT,
  status TEXT,  -- draft | published
  component_pack TEXT,
  created_at TIMESTAMPTZ
);
```

#### `interface_versions`
**⚠️ CRITICAL:** This table is referenced in code but **SCHEMA NOT FOUND** in migrations.

Expected columns (based on code usage):
```
- id UUID PRIMARY KEY
- interface_id UUID REFERENCES interfaces(id)
- spec_json JSONB  -- Dashboard component spec
- design_tokens JSONB  -- Style tokens (colors, fonts, etc.)
- created_by UUID  -- User ID
- created_at TIMESTAMPTZ
- spec_hash TEXT  -- Deduplication hash (generated column)
- content_hash TEXT
```

**Missing:**
- ❌ `updated_at` column (but RPC tries to SET it → **BUG 4**)
- ❌ Index `idx_interface_versions_dedup` (referenced in logs but creation SQL not found)

#### `events`
Stores platform events (workflow runs, API calls, etc.).

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  source_id UUID REFERENCES sources(id),
  interface_id UUID REFERENCES interfaces(id),  -- ⚠️ BUG 5: Always NULL
  run_id UUID,
  type TEXT,
  name TEXT,
  value NUMERIC,
  unit TEXT,
  text TEXT,
  state JSONB,  -- ⚠️ BUG 6: Nested fields like status, duration_ms
  labels JSONB,
  timestamp TIMESTAMPTZ,
  platform_event_id TEXT,  -- Deduplication key
  created_at TIMESTAMPTZ
);

-- Partial unique index for deduplication
CREATE UNIQUE INDEX idx_events_dedup ON events(tenant_id, source_id, platform_event_id)
  WHERE platform_event_id IS NOT NULL;
```

### 3.2 RPC Functions

#### `upsert_events(p_events jsonb)`
**File:** `supabase/migrations/20260211_add_upsert_events_rpc.sql`

Upserts events using the partial unique index. Works correctly ✅

#### `upsert_interface_version(...)`
**Status:** ❌ **DOES NOT EXIST**

**Expected signature (based on code):**
```sql
CREATE FUNCTION upsert_interface_version(
  p_interface_id UUID,
  p_spec_json JSONB,
  p_design_tokens JSONB,
  p_created_by UUID
)
RETURNS TABLE(version_id UUID, was_inserted BOOLEAN)
```

**Issue:** Code calls this RPC but it's never created → fails → falls back to raw INSERT → creates duplicates.

---

## 4. Journey Flow & Phases

**Workflow:** `vibeJourneyWorkflow.ts`

1. **select_entity** - User selects data sources (n8n workflows, Vapi calls, etc.)
2. **recommend** - System recommends dashboard type (analytics, operations, product)
3. **style** - User selects design style
4. **build_preview** - Generate dashboard spec + persist
5. **interactive_edit** - User refines with visual editor
6. **deploy** - Publish to production

**Phase Advancement:**
Tool: `advancePhase.ts`

```typescript
// Updates RequestContext and persists to journey_sessions
context?.requestContext?.set('phase', nextPhase);

// If user selects a style, stores the selection
if (nextPhase === 'build_preview') {
  updateData.selected_style_bundle_id = selectedValue;  // ⚠️ BUG 7
}
```

---

## 5. Design System Pipeline

### 5.1 Workflow Execution

**File:** `mastra/workflows/designSystemWorkflow.ts`

1. Calls `designAdvisorAgent.generate()` with prompt to use `ui-ux-pro-max` skill
2. Agent searches design database via skill tools
3. Returns **ONE** design system object:

```typescript
{
  designSystem: {
    style: { name: "Minimalism & Swiss Style", type: "...", ... },
    colors: { primary: "#0080FF", ... },
    typography: { headingFont: "...", bodyFont: "..." },
    charts: [...],
    uxGuidelines: [...]
  },
  reasoning: "...",
  skillActivated: true
}
```

### 5.2 Rendering in Chat UI

**File:** `src/components/vibe/chat-workspace.tsx:1430-1465`

```typescript
// ✅ Receives ONE design system from workflow
const ds = output.designSystem;

const system1 = {
  id: 'style-workflow-1',
  name: ds.style?.name || 'Recommended Style',
  colors: [...],
  style: ds.style?.keywords || ds.style?.type
};

return (
  <DesignSystemPair
    systems={[system1, system1]}  // ⚠️ BUG 1: Duplicate!
    onSelect={(id) => { ... }}
  />
);
```

**Result:** Both cards show "Minimalism & Swiss Style" because it's literally the same object twice.

### 5.3 Agent Text Fabrication

**Issue (BUG 2):**
The workflow returns ONE style, but the agent's text response fabricates multiple options:

```
Phase 3: Visual Style

Option A: Technical Precision
- Clean layouts...

Option B: Modern SaaS
- Approachable interface...
```

**Cause:**
The text filter in `chat-workspace.tsx:1517-1523` checks for keywords like:
- "Style Option"
- "Design Philosophy"
- "design system"
- "Color Palette"

But the agent uses different phrases:
- "Phase 3: Visual Style"
- "Option A:", "Option B:"

These slip through the filter and render as text alongside the actual tool output.

### 5.4 Style Resolution (BUG 3)

**File:** `mastra/tools/generateUISpec.ts:389-418`

```typescript
export function resolveStyleBundleId(input: string): string {
  const KEYWORD_MAP = {
    'neon-cyber': ['neon', 'cyber', 'monitoring', 'modern', ...],  // ⚠️ 'modern'
    ...
  };

  const inputLower = input.toLowerCase();
  let bestScore = 0;

  for (const [bundleId, keywords] of Object.entries(KEYWORD_MAP)) {
    const score = keywords.filter(kw => inputLower.includes(kw)).length;
    if (score > bestScore) bestMatch = bundleId;
  }
}
```

**Example:**
Input: `"Modern SaaS"` → matches `'modern'` keyword → resolves to `'neon-cyber'`

**neon-cyber tokens:**
```typescript
{
  colors: {
    primary: '#22D3EE',     // Cyan
    background: '#030712',  // Dark navy (almost black)
    text: '#F9FAFB'         // White
  },
  fonts: { heading: 'JetBrains Mono, monospace', ... }
}
```

**Result:** Dark cyberpunk theme on white page = invisible content.

---

## 6. Event Data Pipeline

### 6.1 Event Creation

**Tool:** `fetchPlatformEvents.ts`

**Issue (BUG 5):**
This tool fetches events from platforms (n8n, Vapi, etc.) and stores them but **NEVER sets `interface_id`**.

```typescript
// Pseudocode - actual implementation doesn't include interface_id
const eventPayload = {
  tenant_id,
  source_id,
  // interface_id: ???  ← Missing!
  type,
  name,
  value,
  state: { status, duration_ms, workflow_id, ... }  // Nested!
};
```

**Database Evidence:**
61 of 62 events have `interface_id = NULL`.

### 6.2 Event Query Fallback

**File:** `src/app/preview/[dashboardId]/[versionId]/page.tsx:145-175`

```typescript
// 1. Try: events WHERE interface_id = dashboardId
let { data: directEvents } = await supabase
  .from('events')
  .select('*')
  .eq('interface_id', dashboardId);

if (!directEvents || directEvents.length === 0) {
  // 2. Fallback: journey_sessions → source_id → events WHERE source_id
  const { data: session } = await supabase
    .from('journey_sessions')
    .select('preview_interface_id')
    .eq('preview_interface_id', dashboardId)
    .single();

  if (session?.source_id) {
    const { data: sourceEvents } = await supabase
      .from('events')
      .select('*')
      .eq('source_id', session.source_id);

    resolvedEvents = sourceEvents || [];
  }
}
```

**Problem:**
Even when fallback finds events by `source_id`, most are `thread_event` internal state events (45/62), not actual workflow execution data.

### 6.3 Data Transformation (BUG 6)

**File:** `src/app/preview/[dashboardId]/[versionId]/page.tsx:18-110`

```typescript
function transformDataForComponents(spec, events) {
  // ...
  const tableRows = events.slice(0, 50).map((evt) => ({
    id: evt.id,
    name: evt.name,
    value: evt.value,
    ...(evt.state || {}),  // ✅ Spreads nested state for tables
  }));

  const enrichedComponents = spec.components.map((comp) => {
    switch (normalized) {
      case "MetricCard":
        // ⚠️ Only enriches value/subtitle, doesn't extract from state
        props.value = totalValue || eventCount;
        break;
    }
  });
}
```

**Spec Example (from generateUISpec.ts:127):**
```typescript
{
  type: 'MetricCard',
  props: {
    title: 'Success Rate',
    valueField: 'status',  // ⚠️ Expects top-level field
    aggregation: 'percentage',
    condition: { equals: 'success' }
  }
}
```

**Actual Event Structure:**
```json
{
  "id": "...",
  "name": "workflow_execution",
  "value": null,
  "state": {
    "status": "error",        ← Nested!
    "duration_ms": 1234,      ← Nested!
    "workflow_id": "..."      ← Nested!
  }
}
```

**Result:**
MetricCards reference `status` but it's in `state.status`, not a top-level column → no data extracted.

---

## 7. Style Bundle Token System

**File:** `mastra/tools/generateUISpec.ts:9-72`

### Valid Style Bundle IDs (Token Keys)

1. **professional-clean** - Blue, clean, Inter font
2. **premium-dark** - Dark blue/purple, elegant
3. **glass-premium** - Glassmorphism, frosted effects
4. **bold-startup** - Orange/cyan, energetic
5. **corporate-trust** - Navy, formal, banking
6. **neon-cyber** - Cyan/purple, dark background (#030712), JetBrains Mono
7. **pastel-soft** - Soft colors, wellness
8. **warm-earth** - Browns, organic

### Keyword Matching

Each bundle has keywords for fuzzy matching:

```typescript
const KEYWORD_MAP = {
  'neon-cyber': ['neon', 'cyber', 'monitoring', 'modern', 'electric', ...],
  'professional-clean': ['professional', 'clean', 'minimal', 'simple', ...],
  ...
};
```

**Problem:** Keyword overlap causes mismatches (e.g., "modern" → neon-cyber).

---

## 8. Bug Summary with Root Causes

### BUG 1: Duplicate Design System Cards
**Location:** `src/components/vibe/chat-workspace.tsx:1452`

```typescript
systems={[system1, system1]}  // Same object twice
```

**Fix:** Should generate `system2` or remove DesignSystemPair component (workflow only returns one option).

---

### BUG 2: Agent Text Fabricates Styles
**Location:** `chat-workspace.tsx:1517-1523` + agent responses

**Cause:** Text filter doesn't catch all LLM-generated style descriptions.

**Fix:** Improve filter regex or suppress ALL text when `tool-runDesignSystemWorkflow` output exists.

---

### BUG 3: resolveStyleBundleId("Modern SaaS") → "neon-cyber"
**Location:** `mastra/tools/generateUISpec.ts:399`

**Cause:** 'modern' keyword in neon-cyber list.

**Fix:** Remove 'modern' from neon-cyber keywords OR use smarter matching (exact phrase > single word).

---

### BUG 4: RPC upsert_interface_version References Non-Existent updated_at
**Location:** Missing RPC definition

**Cause:** Code calls `supabase.rpc('upsert_interface_version', ...)` but function doesn't exist.

**Fix:** Create the RPC function (see Expected Schema section).

---

### BUG 5: Events NOT Linked to Interface
**Location:** `mastra/tools/fetchPlatformEvents.ts`

**Cause:** Tool never sets `interface_id` when creating events.

**Fix:** Pass `interface_id` from context or journey session to event creation.

---

### BUG 6: MetricCard Props Reference Fields That Don't Exist
**Location:** `mastra/tools/generateUISpec.ts:117-127` + `src/app/preview/page.tsx:90-94`

**Cause:** Spec references top-level fields (`status`, `duration_ms`) but data is nested in `state` JSONB.

**Fix:** Either:
- Transform: Extract `state.*` to top-level in `transformDataForComponents`
- Spec: Reference `state.status` instead of `status` in component props

---

### BUG 7: Journey Session Stores "Modern SaaS" Instead of "modern-saas" Token Key
**Location:** `mastra/tools/journey/advancePhase.ts:111`

```typescript
if (selectedValue && nextPhase === 'build_preview') {
  updateData.selected_style_bundle_id = selectedValue;  // Raw value!
}
```

**Cause:** Stores display name from user selection, not resolved token key.

**Fix:** Call `resolveStyleBundleId(selectedValue)` before storing.

---

## 9. Recommended Investigation Steps

### For a Deep Research Agent:

1. **Trace Event Flow End-to-End**
   - Start: Platform webhook/polling → `fetchPlatformEvents`
   - Middle: Event storage → `upsert_events` RPC
   - End: Preview page query → `transformDataForComponents`
   - **Goal:** Identify exactly where `interface_id` linking should happen

2. **Audit Style Selection Journey**
   - User action: Clicks style card
   - Frontend: `setSelectedStyleBundleId(id)`
   - Backend: `advancePhase` tool call
   - Database: `journey_sessions.selected_style_bundle_id`
   - Spec generation: `generateUISpec` reads value
   - **Goal:** Trace how "Modern SaaS" (display) becomes "neon-cyber" (token)

3. **Database Schema Validation**
   - Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'interface_versions'`
   - Verify: Does `updated_at` exist?
   - Check: Does `idx_interface_versions_dedup` index exist?
   - **Goal:** Confirm missing schema elements

4. **Event Data Analysis**
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE interface_id IS NOT NULL) as linked,
     COUNT(*) FILTER (WHERE interface_id IS NULL) as unlinked,
     COUNT(*) FILTER (WHERE type = 'thread_event') as internal,
     COUNT(*) FILTER (WHERE state->>'status' = 'success') as success,
     COUNT(*) FILTER (WHERE state->>'status' = 'error') as errors
   FROM events
   WHERE tenant_id = '...';
   ```
   **Goal:** Quantify data quality issues

5. **Component Spec vs Event Schema Mismatch**
   - Extract all `valueField` references from specs
   - Compare to actual event column names + `state` keys
   - Map nested paths: `status` → `state.status`
   - **Goal:** Build a field mapping dictionary

---

## 10. Critical Files for Debugging

### High Priority
1. `src/components/vibe/chat-workspace.tsx` - UI rendering, duplicate cards
2. `mastra/tools/generateUISpec.ts` - Style resolution, component specs
3. `mastra/tools/journey/advancePhase.ts` - Phase transitions, style storage
4. `mastra/tools/fetchPlatformEvents.ts` - Event creation (missing interface_id)
5. `src/app/preview/[dashboardId]/[versionId]/page.tsx` - Data loading, transformation

### Medium Priority
6. `mastra/workflows/designSystemWorkflow.ts` - Design system generation
7. `mastra/agents/designAdvisorAgent.ts` - Design recommendations
8. `supabase/migrations/*.sql` - Schema definitions, RPC functions

### Low Priority (Context)
9. `mastra/index.ts` - Mastra initialization
10. `mastra/workspace/index.ts` - Skill system setup
11. `package.json` - Dependency versions

---

## 11. Environment Variables (Expected)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Server-side only

# AI Models
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Mastra
DEBUG_MASTRA_BOOT=true  # Optional debug logging
MASTRA_DEV_NO_CACHE=1   # Disable caching in dev
```

---

## 12. Testing Strategy

### Unit Tests Needed
1. `resolveStyleBundleId()` - Test all keyword matches
2. `transformDataForComponents()` - Test state field extraction
3. `advancePhase()` - Test style bundle resolution before storage

### Integration Tests Needed
1. Full journey flow: select → recommend → style → build → edit
2. Event creation with interface linking
3. Preview page data loading with proper field mapping

### Manual Verification
1. Generate dashboard with "Modern SaaS" style → Verify color scheme is NOT neon-cyber
2. Check events table → Verify interface_id is set
3. Check MetricCard rendering → Verify success rate calculates correctly

---

## Conclusion

Flowetic has a sophisticated multi-agent architecture with a strong foundation, but suffers from 7 interconnected bugs primarily related to:

1. **Data Plumbing** - Events not linked to interfaces (BUG 5)
2. **Field Mapping** - Nested state vs top-level columns (BUG 6)
3. **Style Resolution** - Display names vs token keys (BUG 3, 7)
4. **Missing Infrastructure** - RPC function not created (BUG 4)
5. **UI Rendering** - Duplicate objects, text filtering (BUG 1, 2)

**Next Steps:** Use this report to guide a deep research agent to trace data flows, validate schema assumptions, and propose surgical fixes for each bug.
