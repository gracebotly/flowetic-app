-- Migration: Add partial unique index for event deduplication
-- This enables ON CONFLICT upsert in storeEvents tool

-- Step 1: Remove existing duplicates (keep earliest row per dedup key)
DELETE FROM public.events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, source_id, platform_event_id
        ORDER BY created_at ASC, id ASC
      ) AS row_num
    FROM public.events
    WHERE platform_event_id IS NOT NULL
  ) t
  WHERE t.row_num > 1
);

-- Step 2: Create partial unique index for deduplication
-- Partial index only enforces uniqueness when platform_event_id IS NOT NULL
-- This allows events without platform_event_id to be inserted freely
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup_platform_event
ON public.events (tenant_id, source_id, platform_event_id)
WHERE platform_event_id IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON INDEX idx_events_dedup_platform_event IS 
  'Partial unique index for event deduplication. Only enforces uniqueness when platform_event_id is present.';