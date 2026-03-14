-- ═══════════════════════════════════════════════════════════════
-- P2: Drop dead tables — verified safe via live Supabase MCP
--
-- Criteria for dropping:
-- 1. Zero live code references (grep confirmed across src/)
-- 2. No FK from tables with data (unless ON DELETE SET NULL/CASCADE)
-- 3. Not part of Mastra SDK scaffolding (all mastra_* tables kept)
-- 4. Not an active product table (portal_customers, workflow_executions,
--    stripe_webhook_events kept — they're empty but used by live code)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Group 1: Simple drops — no FK references from other tables ──

-- todos: 57 rows, self-referencing FK only, zero live code refs
-- (only ref was in deleted vibe/chat-workspace.tsx type definition)
DROP TABLE IF EXISTS public.todos CASCADE;

-- journey_messages: 792 rows, no children, zero live code refs
-- (API routes deleted in legacy cleanup)
DROP TABLE IF EXISTS public.journey_messages CASCADE;

-- journey_sessions: 146 rows, no children, zero live code refs
-- (API routes deleted in legacy cleanup, only refs in vibe/ and types/proposal.ts comments)
DROP TABLE IF EXISTS public.journey_sessions CASCADE;

-- uiux_data: 961 rows, no FK refs, zero live code refs
-- (was for design KB search — Mastra tool references it as "local" fallback but never queries the table directly)
DROP TABLE IF EXISTS public.uiux_data CASCADE;

-- skill_compliance_logs: 22 rows, no FK refs, zero live code refs
-- (dev telemetry from skills refactor, never queried by app)
DROP TABLE IF EXISTS public.skill_compliance_logs CASCADE;

-- thread_events: 34 rows, no FK refs, zero live code refs
-- (only ref in orphan lib/threadEvents.ts which is also being deleted)
DROP TABLE IF EXISTS public.thread_events CASCADE;

-- scores: 0 rows, FK to runs(run_id), zero live code refs
DROP TABLE IF EXISTS public.scores CASCADE;

-- usage_counters: 0 rows, FK to tenants(tenant_id), zero live code refs
DROP TABLE IF EXISTS public.usage_counters CASCADE;

-- project_memberships: 0 rows, FK to projects + users, zero live code refs
DROP TABLE IF EXISTS public.project_memberships CASCADE;

-- projects: 3 rows, no children after project_memberships dropped, zero live code refs
-- (API routes deleted in legacy cleanup)
DROP TABLE IF EXISTS public.projects CASCADE;

-- ── Group 2: Dependent chain — drop children first, then parents ──

-- run_steps: 0 rows, FK to runs(run_id), zero live code refs
DROP TABLE IF EXISTS public.run_steps CASCADE;

-- runs: 0 rows, children (run_steps, scores) already dropped above
-- events.run_id FK is ON DELETE SET NULL — dropping runs sets events.run_id to NULL
-- (events.run_id is already NULL for all 278 rows, confirmed via MCP)
-- Only code ref was orphan lib/mastra/run.ts (also being deleted)
DROP TABLE IF EXISTS public.runs CASCADE;

-- deployments: 0 rows, FK to tenants + interfaces + interface_versions
-- No live code references
DROP TABLE IF EXISTS public.deployments CASCADE;

-- interface_schemas: 2 rows, FK to interfaces + source_entities + sources
-- Zero live code references
DROP TABLE IF EXISTS public.interface_schemas CASCADE;

-- interface_versions: 58 rows, FK to interfaces
-- interfaces.active_version_id FK points back (circular)
-- No live code references
-- Must nullify the back-reference first
UPDATE public.interfaces SET active_version_id = NULL WHERE active_version_id IS NOT NULL;
DROP TABLE IF EXISTS public.interface_versions CASCADE;

-- ── Group 3: interfaces table — the big one ──
-- 126 rows, but zero live code queries this table
-- client_portals has 4 FK columns pointing here (all NULL for all 4 portals, confirmed)
-- events has FK interface_id (ON DELETE SET NULL, 171 rows will become NULL)
-- Drop FK constraints on client_portals first (no ON DELETE clause = RESTRICT)

ALTER TABLE public.client_portals DROP CONSTRAINT IF EXISTS client_portals_interface_id_fkey;
ALTER TABLE public.client_portals DROP CONSTRAINT IF EXISTS client_portals_landing_page_id_fkey;
ALTER TABLE public.client_portals DROP CONSTRAINT IF EXISTS client_portals_form_wizard_id_fkey;
ALTER TABLE public.client_portals DROP CONSTRAINT IF EXISTS client_portals_results_display_id_fkey;

-- Now drop the FK columns too — they're all NULL and unused by any code
ALTER TABLE public.client_portals DROP COLUMN IF EXISTS interface_id;
ALTER TABLE public.client_portals DROP COLUMN IF EXISTS landing_page_id;
ALTER TABLE public.client_portals DROP COLUMN IF EXISTS form_wizard_id;
ALTER TABLE public.client_portals DROP COLUMN IF EXISTS results_display_id;

-- events.interface_id is ON DELETE SET NULL — 171 rows will get nullified
-- This is fine: the portal rendering system uses skeleton_id, not interface_id
DROP TABLE IF EXISTS public.interfaces CASCADE;

-- ── Group 4: Drop unused view ──

-- portal_revenue_summary: zero code references, not used by revenue page
-- (revenue page queries /api/client-portals/analytics directly)
DROP VIEW IF EXISTS public.portal_revenue_summary;

-- ── Group 5: Drop events FK column that pointed to deleted runs table ──
-- events.run_id was already NULL for all rows, and the runs table is gone
ALTER TABLE public.events DROP COLUMN IF EXISTS run_id;

COMMIT;
