# Flowetic App - Technical Architecture & Bug Analysis Report
**Generated:** 2026-02-15
**Context:** Multi-agent dashboard builder with AI SDK v5 + Mastra framework
**Purpose:** Deep debugging context for 7 critical bugs affecting data flow, styling, and persistence

---

## 📦 Technology Stack

### Core Frameworks
```json
{
  "Next.js": "16.1.1",
  "React": "19.2.3",
  "TypeScript": "5.9.3"
}
```

### AI/Agent Layer
```json
{
  "@mastra/core": "1.1.0",
  "@mastra/ai-sdk": "1.0.3",
  "@mastra/memory": "1.0.1",
  "@mastra/pg": "1.1.0",
  "@mastra/rag": "1.1.0",
  "@ai-sdk/react": "2.0.39",
  "@ai-sdk/anthropic": "2.0.0",
  "@ai-sdk/google": "2.0.0",
  "@ai-sdk/openai": "2.0.0",
  "ai": "5.0.0"
}
```

### Database
```json
{
  "@supabase/supabase-js": "2.89.0",
  "@supabase/ssr": "0.8.0",
  "Postgres": "15.x (via Supabase)"
}
```

### UI/Visualization
```json
{
  "@tremor/react": "3.14.0",
  "@radix-ui/*": "Multiple packages",
  "framer-motion": "11.11.11",
  "lucide-react": "0.453.0",
  "tailwindcss": "4.x"
}
```

---

## 🏗️ Architecture Overview

### Agent System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User (Chat Interface)                      │
│                 src/components/vibe/chat-workspace.tsx       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ useChat (AI SDK v5)
                             │ DefaultChatTransport
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              API Route: /api/chat/route.ts                   │
│  • Auth validation (Supabase)                                │
│  • Tenant verification                                        │
│  • Thread management (ensureMastraThread)                    │
│  • Phase override from DB (journey_sessions)                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ handleChatStream
                             ↓
┌─────────────────────────────────────────────────────────────┐
│           masterRouterAgent (Mastra Agent)                   │
│  • Model: claude-3-7-sonnet-20250219                         │
│  • Routing logic for phase-based delegation                  │
│  • Tools: 40+ tools including journey/*, design/*, etc.      │
└────────────────────────────┬────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ↓            ↓            ↓
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │designAdvisor │ │dashboardBuilder│ │platformMapper│
     │    Agent     │ │     Agent      │ │    Agent     │
     └──────────────┘ └──────────────┘ └──────────────┘
```

### Journey Flow (Happy Path)

```
1. select_entity    → User picks workflow from n8n/Make
                     → Tool: fetchPlatformEvents
                     → Tool: generateSchemaSummaryFromEvents

2. recommend        → Agent analyzes workflow purpose
                     → Tool: runDesignSystemWorkflow
                     → Returns: Single DesignSystem object

3. style            → User selects from design system options
                     → Tool: advancePhase(nextPhase: "build_preview")
                     → Stores: selected_style_bundle_id = "Modern SaaS" (BUG 7!)

4. build_preview    → Tool: generateMapping (workflow → dashboard fields)
                     → Tool: generateUISpec (creates spec_json + design_tokens)
                     → Style resolution: resolveStyleBundleId("Modern SaaS")
                       → Matches keyword "modern" → Returns "neon-cyber" (BUG 3!)
                     → Tool: savePreviewVersion
                     → RPC: upsert_interface_version (BUG 4: updated_at column!)

5. interactive_edit → User tweaks dashboard via chat
                     → Tool: applySpecPatch (with deepMerge protection)

6. deploy           → Tool: setJourneyDeployed
```

---

## 🐛 Bug Analysis & Root Causes

### BUG 1: Duplicate Design System Cards — `[system1, system1]`

**Location:** `src/components/vibe/chat-workspace.tsx:1452`

```typescript
// ❌ CURRENT CODE (WRONG)
const system1 = {
  id: 'style-workflow-1',
  name: ds.style?.name || 'Recommended Style',
  icon: 'Palette',
  colors: [...].join(' / '),
  // ...
};
return (
  <DesignSystemPair
    systems={[system1, system1] as [typeof system1, typeof system1]} // ← BUG!
    onSelect={(id) => { /* ... */ }}
  />
);
```

**Root Cause:**
The `runDesignSystemWorkflow` returns a **single design system object**, but the UI rendering code **duplicates it twice** into the `systems` array instead of creating two different design options.

**Expected Behavior:**
Should either:
- Generate 2 different design systems from the workflow
- OR use a different UI component (not `DesignSystemPair`) for single-option rendering

**Impact:**
User sees identical "OPTION 1" and "OPTION 2" cards, creating confusion.

---

### BUG 2: Agent Text Fabricates Styles Not From Tools

**Location:** `src/components/vibe/chat-workspace.tsx:1509-1522`

```typescript
// Text suppression filter
if (
  text.includes('Style Option') ||
  text.includes('Design Philosophy') ||
  text.includes('design system') ||
  text.includes('Color Palette')
) {
  return null; // Suppress duplicate text
}
```

**Root Cause:**
The agent generates markdown like:
```
## Phase 3: Visual Style

**Option A: Technical Precision**
- Colors: #0066FF, #00C8FF
- For: Monitoring dashboards

**Option B: Modern SaaS**
- Colors: #6366F1, #8B5CF6
- For: Product analytics
```

But the text filter only checks for exact phrases like `"Style Option"` or `"Design Philosophy"`, **not** `"Option A:"` or `"Phase 3:"`. So the fabricated text slips through and displays alongside the tool-generated design system cards.

**Why Agent Fabricates:**
The agent has been trained on design patterns and uses its own knowledge to suggest styles. The `runDesignSystemWorkflow` tool returns ONE style (e.g., "Minimalism & Swiss Style" with #0080FF), but the agent wants to give the user **choices**, so it invents alternatives from its training data.

**Impact:**
User sees 3 different styles:
1. Tool result: "Minimalism & Swiss Style" (card)
2. Agent text: "Option A: Technical Precision" (markdown)
3. Agent text: "Option B: Modern SaaS" (markdown)

But when user says "I want Modern SaaS", the system doesn't have that data — it only has the tool result.

---

### BUG 3: `resolveStyleBundleId("Modern SaaS")` → `"neon-cyber"`

**Location:** `mastra/tools/generateUISpec.ts:389-418`

```typescript
export function resolveStyleBundleId(input: string): string {
  if (STYLE_BUNDLE_TOKENS[input]) return input; // Direct match

  const KEYWORD_MAP: Record<string, string[]> = {
    'neon-cyber': ['neon', 'cyber', 'monitoring', 'modern', 'electric', ...],
    'pastel-soft': ['pastel', 'soft', 'gentle', 'calming', ...],
    // ...
  };

  const inputLower = input.toLowerCase().replace(/[-_]/g, ' ');
  let bestMatch = 'professional-clean';
  let bestScore = 0;

  for (const [bundleId, keywords] of Object.entries(KEYWORD_MAP)) {
    const score = keywords.filter(kw => inputLower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = bundleId;
    }
  }

  console.log(`[generateUISpec] Resolved style "${input}" → "${bestMatch}" (score: ${bestScore})`);
  return bestMatch;
}
```

**Root Cause:**
"Modern SaaS" contains the substring **"modern"**, which is a keyword for `'neon-cyber'`. The fuzzy matching algorithm scores bundles by keyword overlap:
- `'neon-cyber'`: ["modern", ...] → Score: 1
- All other bundles: No match → Score: 0

So `"neon-cyber"` wins, even though the user wanted a **soft, friendly SaaS style**.

**Actual `neon-cyber` Tokens:**
```typescript
'neon-cyber': {
  colors: {
    primary: '#22D3EE',      // Bright cyan
    secondary: '#3B82F6',    // Blue
    accent: '#8B5CF6',       // Purple
    background: '#030712',   // Near-black
    text: '#F9FAFB',         // White
  },
  // ... (dark cyberpunk theme)
}
```

**What User Wanted:**
A light, modern SaaS palette (think Stripe, Linear, Vercel) with soft blues/purples on a white background.

**Impact:**
Preview page renders with:
- `background: "#030712"` (dark) on white page → invisible/broken
- Neon colors instead of friendly pastels
- Dark theme when user expected light

---

### BUG 4: RPC `upsert_interface_version` References Non-Existent `updated_at` Column

**Location:** `mastra/tools/persistPreviewVersion.ts:99-118`

```typescript
const { data: rpcResult, error: rpcError } = await supabase
  .rpc('upsert_interface_version', {
    p_interface_id: finalInterfaceId,
    p_spec_json: spec_json,
    p_design_tokens: design_tokens,
    p_created_by: userId,
  })
  .single<{ version_id: string; was_inserted: boolean }>();

if (rpcError) {
  console.warn('[persistPreviewVersion] RPC failed:', rpcError.message);
} else if (rpcResult) {
  return { interfaceId, versionId: rpcResult.version_id, previewUrl };
}

// Fallback to raw INSERT if RPC fails
```

**Database Schema (ACTUAL):**
```sql
-- From migrations/20260204_create_interface_schemas.sql
-- NOTE: This file creates interface_SCHEMAS, NOT interface_versions!
-- The interface_versions table schema is NOT in the provided migrations.

-- Expected columns (based on code usage):
interface_versions:
  - id (UUID PRIMARY KEY)
  - interface_id (UUID FK)
  - spec_json (JSONB)
  - design_tokens (JSONB)
  - created_by (UUID FK to users)
  - created_at (TIMESTAMPTZ)
  - spec_hash (TEXT, generated column)
  - content_hash (TEXT, generated column)

-- ❌ NO updated_at COLUMN!
```

**RPC Function (INFERRED from error):**
```sql
-- The RPC likely does:
CREATE OR REPLACE FUNCTION upsert_interface_version(...)
RETURNS TABLE (version_id UUID, was_inserted BOOLEAN)
AS $$
BEGIN
  INSERT INTO interface_versions (...)
  VALUES (...)
  ON CONFLICT (interface_id, spec_hash) DO UPDATE
    SET updated_at = now()  -- ← BUG! Column doesn't exist
  RETURNING id AS version_id, (xmax = 0) AS was_inserted;
END;
$$ LANGUAGE plpgsql;
```

**Impact:**
Every `savePreviewVersion` call:
1. RPC fails with "column updated_at does not exist"
2. Falls back to raw INSERT (no deduplication)
3. Creates duplicate versions with identical spec_json

**Dedup Index (EXISTS):**
```sql
-- From logs: constraint "idx_interface_versions_dedup"
-- Likely: CREATE UNIQUE INDEX idx_interface_versions_dedup
--         ON interface_versions(interface_id, spec_hash);
```

So the index IS there for dedup, but the ON CONFLICT handler crashes before dedup logic runs.

---

### BUG 5: Events NOT Linked to Interface (CRITICAL DATA GAP)

**Database State:**
```sql
-- events table: 62 total rows
SELECT interface_id, COUNT(*) FROM events GROUP BY interface_id;
-- Results:
--   NULL: 61 events  ← NOT LINKED!
--   7b8009e8-...: 1 event (different interface, not the active preview)

-- Active preview interface: 80968ddd-...
-- Query: SELECT * FROM events WHERE interface_id = '80968ddd-...'
-- Result: 0 rows
```

**Event Types Breakdown:**
```sql
-- Of 62 events, 45 are internal threading events:
SELECT type FROM events WHERE type = 'thread_event';
-- 45 rows (internal state, not metric data)

-- Actual workflow execution events: 13
-- ALL have status: "error" (no success events!)
```

**Preview Page Query Logic:**
```typescript
// src/app/preview/[dashboardId]/[versionId]/page.tsx:149-174

// 1. Primary query: by interface_id
const { data: events } = await supabase
  .from("events")
  .eq("interface_id", dashboardId) // ← Gets 0 rows (all are NULL)
  .limit(200);

// 2. Fallback: via journey_sessions → source_id
let resolvedEvents = events || [];
if (resolvedEvents.length === 0) {
  const { data: session } = await supabase
    .from("journey_sessions")
    .eq("preview_interface_id", dashboardId)
    .maybeSingle();

  if (session?.source_id) {
    const { data: sourceEvents } = await supabase
      .from("events")
      .eq("source_id", session.source_id) // ← Gets 62 events
      .limit(200);
    resolvedEvents = sourceEvents || [];
  }
}
```

**Why Events Aren't Linked:**
The `fetchPlatformEvents` tool (or equivalent) fetches events from n8n/Make and inserts them into `events` table, but **doesn't set `interface_id`**. It only sets `source_id` (the connection UUID).

**Impact:**
Preview dashboards show:
- Fallback data from source (includes thread_event noise)
- No clean interface-specific metrics
- All "error" status (no success events) → KPIs show 0% success rate, no valid data

---

### BUG 6: MetricCard Props Reference Fields That Don't Exist

**Spec Example (from generateUISpec):**
```typescript
{
  id: "card-total-executions",
  type: "MetricCard",
  props: {
    title: "Total Executions",
    value: "{{workflow_id}}", // ← Field doesn't exist at top level!
    subtitle: "All time",
    // ...
  }
}
```

**Event Schema (ACTUAL):**
```sql
events:
  - id (UUID)
  - type (TEXT)
  - name (TEXT)
  - value (NUMERIC)
  - unit (TEXT)
  - text (TEXT)
  - state (JSONB) ← Fields like workflow_id, status, duration_ms are HERE
  - timestamp (TIMESTAMPTZ)
  - source_id (UUID)
  - interface_id (UUID) -- mostly NULL per BUG 5
```

**Event Data Example:**
```json
{
  "id": "abc123...",
  "type": "workflow_execution",
  "name": "n8n Webhook Handler",
  "value": null,
  "state": {
    "workflow_id": "wf_12345",     // ← Nested inside state JSONB
    "status": "error",              // ← Nested inside state JSONB
    "duration_ms": 342,             // ← Nested inside state JSONB
    "mode": "webhook"
  },
  "timestamp": "2026-02-14T..."
}
```

**Transform Function (Incomplete):**
```typescript
// src/app/preview/[dashboardId]/[versionId]/page.tsx:18-130
function transformDataForComponents(spec, events) {
  // Builds aggregates:
  // - hourlyBuckets (time series)
  // - nameCounts (for pie/bar)
  // - totalValue, eventCount

  // ❌ DOES NOT extract state->>'workflow_id'
  // ❌ DOES NOT compute status breakdown
  // ❌ DOES NOT aggregate duration_ms

  // Just injects raw aggregates into components
}
```

**Impact:**
MetricCards show:
- `value: "—"` (placeholder, no data extracted)
- Time series charts: Aggregate by hour (works)
- Status breakdowns: Missing (would need `state->>'status'`)
- Performance metrics: Missing (would need `state->>'duration_ms'`)

---

### BUG 7: Journey Session Has `selected_style_bundle_id = "Modern SaaS"` (Invalid Token Key)

**Location:** `mastra/tools/journey/advancePhase.ts:107-112`

```typescript
const updateData: Record<string, string> = {
  mode: nextPhase,
  updated_at: new Date().toISOString(),
};
if (selectedValue && nextPhase === 'style') {
  updateData.selected_outcome = selectedValue;
}
if (selectedValue && nextPhase === 'build_preview') {
  updateData.selected_style_bundle_id = selectedValue; // ← BUG! Raw user input
}
```

**Database State:**
```sql
SELECT selected_style_bundle_id FROM journey_sessions
WHERE thread_id = '...';
-- Result: "Modern SaaS"  ← Display name, NOT a valid key
```

**Valid Keys (from STYLE_BUNDLE_TOKENS):**
```typescript
{
  'professional-clean',
  'premium-dark',
  'glass-premium',
  'bold-startup',
  'corporate-trust',
  'neon-cyber',
  'pastel-soft',
  'warm-earth'
}
```

**Root Cause:**
The `advancePhase` tool receives `selectedValue` from the user's choice (e.g., "Modern SaaS" from agent's fabricated text), and **stores it directly** without validating or resolving to a canonical key.

Then when `generateUISpec` runs:
```typescript
const rawStyleBundleId =
  inputData.selectedStyleBundleId ||
  context?.requestContext?.get('selectedStyleBundleId') || // ← Gets "Modern SaaS" from session
  'professional-clean';

const styleBundleId = resolveStyleBundleId(rawStyleBundleId); // → "neon-cyber" (BUG 3!)
```

**Impact:**
Invalid key stored → fuzzy matcher activates → wrong style applied.

---

## 📊 Data Flow Diagram (With Bugs Annotated)

```
┌─────────────────────────────────────────────────────────────┐
│  1. User: "I want to build a dashboard for my n8n workflow" │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  2. masterRouterAgent → runDesignSystemWorkflow              │
│     Returns: 1 design system                                 │
│     ❌ BUG 1: UI duplicates it → [system1, system1]          │
│     ❌ BUG 2: Agent adds "Option A/B" text from LLM knowledge│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  3. User: "I like Modern SaaS"                               │
│     advancePhase(nextPhase: "build_preview", selectedValue: │
│                  "Modern SaaS")                              │
│     ❌ BUG 7: Stores "Modern SaaS" in selected_style_bundle_id│
│              (should be canonical key like "pastel-soft")   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  4. generateUISpec                                           │
│     Resolves: "Modern SaaS" → "neon-cyber" (keyword: modern) │
│     ❌ BUG 3: Wrong style! User wanted light SaaS, got dark  │
│              cyberpunk theme                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  5. savePreviewVersion                                       │
│     RPC: upsert_interface_version(...)                       │
│     ❌ BUG 4: SET updated_at = now() → Column doesn't exist  │
│              Falls back to raw INSERT → Creates duplicates   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Preview Page Loads                                       │
│     Query: WHERE interface_id = dashboardId                  │
│     ❌ BUG 5: Returns 0 rows (all events have interface_id = NULL)│
│              Fallback: source_id → Gets 62 events (45 are    │
│              thread_event, 13 are workflow_execution errors) │
│     transformDataForComponents(...) enriches props           │
│     ❌ BUG 6: Props reference {{status}}, {{workflow_id}}    │
│              But data is nested in state JSONB, not extracted│
│              Result: All cards show "—" placeholder          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  7. Rendered Dashboard                                       │
│     • Dark background (#030712) on white page → invisible    │
│     • No metric data (all "—")                               │
│     • Charts show time series (works) but no status/KPIs     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Debt & Known Issues

### 1. **Skill System** (ui-ux-pro-max)
**File:** `mastra/skills/index.ts`, `mastra/lib/skillMdGenerator.ts`

The app uses a "skill" system where `.md` files in `mastra/skills/` define tools and instructions that get loaded into agent context. The `ui-ux-pro-max` skill provides design recommendations via tools like:
- `getStyleRecommendations`
- `getChartRecommendations`
- `getTypographyRecommendations`
- `getUXGuidelines`

**Problem:**
Skill activation is inconsistent. `runDesignSystemWorkflow` delegates to `designAdvisorAgent` which is configured with the skill, but sometimes the skill isn't loaded in context, causing the agent to fallback to generic defaults instead of querying the design database.

### 2. **Thread ID Confusion** (journey_sessions)
**Columns:** `thread_id` vs `mastra_thread_id`

- `thread_id`: Journey-level UUID (from frontend `crypto.randomUUID()`)
- `mastra_thread_id`: Mastra Memory thread UUID (from `Memory.createThread()`)

Some tools query by `thread_id`, others by `mastra_thread_id`. The `api/chat` route tries both (see lines 194-211), but there's no guarantee they're always in sync.

**Compound ID Issue (RESOLVED):**
Earlier versions had UUID sanitization bugs where composite IDs like `"sourceId:externalId"` were passed around. This was fixed in commit `a3b5aff` by centralizing `safeUuid()` into `mastra/lib/safeUuid.ts`.

### 3. **Event Schema Normalization**
**Current:** Events have a flexible `state` JSONB column for workflow-specific data.
**Problem:** No typed schema. Different event types store different fields:
- `workflow_execution`: `{workflow_id, status, duration_ms, mode}`
- `thread_event`: `{phase, message, metadata}`
- `api_call`: `{endpoint, method, status_code, response_time}`

The preview page doesn't know how to extract these. It just aggregates by `timestamp` and `name`.

**Recommendation:**
Add event type handlers to `transformDataForComponents()`:
```typescript
function extractMetrics(events: Event[]) {
  const workflows = events.filter(e => e.type === 'workflow_execution');
  const statusCounts = workflows.reduce((acc, e) => {
    const status = e.state?.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  // ...
}
```

### 4. **RxJS Version Pinning**
```json
{
  "resolutions": { "rxjs": "7.8.1" },
  "overrides": { "rxjs": "7.8.1" }
}
```
Mastra has transitive dependencies that pull different RxJS versions. The app pins to `7.8.1` to avoid conflicts.

---

## 🗂️ File Structure (Key Areas)

```
flowetic-app/
├── mastra/
│   ├── agents/
│   │   ├── masterRouterAgent.ts       # Main entry point, phase routing
│   │   ├── dashboardBuilderAgent.ts   # Interactive edit, spec patching
│   │   ├── designAdvisorAgent.ts      # Design system generation
│   │   └── platformMappingMaster.ts   # Workflow → dashboard field mapping
│   ├── tools/
│   │   ├── generateUISpec.ts          # BUG 3: Style resolution
│   │   ├── persistPreviewVersion.ts   # BUG 4: RPC call
│   │   ├── journey/
│   │   │   ├── advancePhase.ts        # BUG 7: Stores raw style name
│   │   │   └── getJourneySession.ts
│   │   ├── design/
│   │   │   └── runDesignSystemWorkflow.ts # Returns single design system
│   │   ├── specEditor/
│   │   │   ├── applySpecPatch.ts      # Deep-merge protection for tokens
│   │   │   └── savePreviewVersion.ts
│   │   └── fetchPlatformEvents.ts     # BUG 5: Doesn't set interface_id
│   ├── workflows/
│   │   ├── designSystemWorkflow.ts    # Delegates to designAdvisorAgent
│   │   └── generatePreview.ts
│   └── lib/
│       ├── safeUuid.ts                # Centralized UUID sanitization
│       └── ensureMastraThread.ts      # Thread/session management
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts          # Main agent endpoint
│   │   │   └── indexed-entities/list/route.ts # Returns entityUuid
│   │   └── preview/[dashboardId]/[versionId]/page.tsx # BUG 5 & 6
│   └── components/
│       ├── vibe/
│       │   └── chat-workspace.tsx     # BUG 1 & 2: Rendering logic
│       └── preview/
│           └── ResponsiveDashboardRenderer.tsx # Renders spec_json
└── supabase/
    └── migrations/
        ├── 20260204_create_interface_schemas.sql
        └── (Missing: interface_versions table schema & upsert RPC)
```

---

## 🎯 Priority Fix Recommendations

### HIGH PRIORITY (Breaks Core Functionality)

1. **BUG 4: Fix `upsert_interface_version` RPC**
   - Add `updated_at TIMESTAMPTZ DEFAULT NOW()` to `interface_versions` table
   - OR remove `SET updated_at = now()` from RPC conflict handler
   - **Impact:** Prevents duplicate versions, enables deduplication

2. **BUG 5: Link Events to Interface**
   - Update `fetchPlatformEvents` to set `interface_id` when inserting events
   - Backfill existing events: `UPDATE events SET interface_id = (SELECT preview_interface_id FROM journey_sessions WHERE source_id = events.source_id)`
   - **Impact:** Preview pages get correct data

3. **BUG 3: Fix Style Resolution**
   - Create bidirectional mapping: `DISPLAY_NAME_TO_KEY` and `KEY_TO_DISPLAY_NAME`
   - When agent says "Modern SaaS", map to `'pastel-soft'` or create new bundle
   - **Impact:** Correct theme applied

### MEDIUM PRIORITY (Confusing UX)

4. **BUG 1: Fix Design System Duplication**
   - Either generate 2 different systems OR use single-option UI component
   - Update `runDesignSystemWorkflow` to return `{ systems: [system1, system2] }`
   - **Impact:** User sees real choices

5. **BUG 2: Suppress Agent Fabrication**
   - Expand text filter regex to match `"Option A:"`, `"Phase N:"`, etc.
   - OR instruct agent to ONLY show tool results, never invent alternatives
   - **Impact:** Cleaner UI, no confusion

6. **BUG 7: Validate Style Bundle ID**
   - `advancePhase`: Resolve `selectedValue` via `resolveStyleBundleId()` before storing
   - Store canonical key in `selected_style_bundle_id`
   - **Impact:** Consistent style keys

### LOW PRIORITY (Data Extraction)

7. **BUG 6: Extract State JSONB Fields**
   - Add type-specific handlers to `transformDataForComponents()`
   - Extract `state->>'status'`, `state->>'workflow_id'`, etc.
   - Compute metrics: success rate, avg duration, error breakdown
   - **Impact:** Rich dashboard metrics

---

## 📝 Summary for Deep Research Agent

**What to investigate:**

1. **Why is `updated_at` missing from `interface_versions`?**
   - Check if there's a migration that adds it that wasn't run
   - Or if the RPC is wrong and should use a different approach

2. **How should style selection work end-to-end?**
   - Should agent generate 2 design systems?
   - Or should `STYLE_BUNDLE_TOKENS` have "Modern SaaS" as a key?
   - What's the canonical source of truth for style names?

3. **Event linking strategy:**
   - When should `interface_id` be set? At insertion or later?
   - Should it be backfilled for existing events?
   - How to handle events that belong to multiple interfaces (shared source)?

4. **Mastra skill activation reliability:**
   - Why does `ui-ux-pro-max` sometimes not load?
   - Is there a cache issue or agent configuration problem?

**Files to examine closely:**
- `supabase/migrations/*.sql` — Find the actual `interface_versions` schema and RPC
- `mastra/workflows/designSystemWorkflow.ts` — Can it return multiple systems?
- `mastra/tools/fetchPlatformEvents.ts` — Where does `interface_id` get set?
- `src/components/vibe/chat-workspace.tsx:1429-1467` — Design system rendering logic

**Testing checklist:**
- [ ] Run migration to add `updated_at` to `interface_versions`
- [ ] Create style bundle `'modern-saas'` with light palette
- [ ] Backfill `events.interface_id` from `journey_sessions`
- [ ] Update `transformDataForComponents()` to extract `state` fields
- [ ] Fix `systems={[system1, system1]}` → `systems={[system1, system2]}`
- [ ] Expand text suppression filter to catch "Option A/B"
- [ ] Add `resolveStyleBundleId()` call in `advancePhase` before storing

---

**End of Report**
Generated by: Claude Code
Session: https://claude.ai/code/session_01LLB88WKpVnchNj2bBwHh5q
