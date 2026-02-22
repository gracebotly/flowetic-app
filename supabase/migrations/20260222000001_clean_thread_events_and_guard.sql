-- ============================================================================
-- Fix: Clean internal agent bookkeeping events from the events table
-- and prevent future pollution.
--
-- Problem:
--   appendThreadEvent tool writes conversation bookkeeping (name='thread_event')
--   directly to the events table. These are NOT real workflow data.
--   Result: 54 fake rows pollute 13 real workflow_execution rows.
--
-- Solution:
--   1. Delete existing junk rows (all tenants, not just one source)
--   2. Redirect appendThreadEvent to a separate table (thread_events)
--      so future bookkeeping never touches the events table.
-- ============================================================================

-- Step 1: Delete ALL thread_event rows from events table (all tenants)
DELETE FROM public.events WHERE name = 'thread_event';

-- Step 2: Create dedicated thread_events table if it doesn't exist.
-- This table already exists (src/lib/threadEvents.ts references it),
-- but ensure it has the right schema for appendThreadEvent output.
CREATE TABLE IF NOT EXISTS public.thread_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  thread_id TEXT NOT NULL,
  source_id UUID,
  interface_id UUID,
  run_id UUID,
  type TEXT NOT NULL CHECK (type IN ('state', 'tool_event', 'error')),
  message TEXT,
  metadata JSONB,
  labels JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: thread_events scoped to tenant
ALTER TABLE public.thread_events ENABLE ROW LEVEL SECURITY;

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_thread_events_tenant_thread
  ON public.thread_events (tenant_id, thread_id, timestamp DESC);
