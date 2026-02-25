-- ============================================================
-- Fix: Ghost Events Cleanup + Dedup Hardening
-- Date: 2026-02-25
-- ============================================================

-- Step 1: Delete ghost events (events with no state and no platform_event_id)
-- These were created by backfill runs where the normalizer failed to extract data.
DELETE FROM public.events
WHERE state IS NULL
  AND platform_event_id IS NULL;

-- Log how many were deleted (visible in migration output)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % ghost events (null state + null platform_event_id)', deleted_count;
END $$;

-- Step 2: Backfill state from labels for events that have labels but no state.
-- The n8n import route (before this fix) wrote data to labels{} instead of state{}.
-- This converts them so events_flat view can read them.
UPDATE public.events
SET state = jsonb_build_object(
  'workflow_id',    COALESCE(labels->>'workflow_id', ''),
  'workflow_name',  COALESCE(labels->>'workflow_name', ''),
  'execution_id',  COALESCE(labels->>'execution_id', COALESCE(platform_event_id, '')),
  'status',        COALESCE(labels->>'status', 'unknown'),
  'started_at',    COALESCE(to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), ''),
  'ended_at',      '',
  'platform',      COALESCE(labels->>'platformType', labels->>'platform', 'n8n')
),
-- Also set platform_event_id from labels if missing
platform_event_id = COALESCE(
  platform_event_id,
  labels->>'execution_id',
  labels->>'call_id'
)
WHERE state IS NULL
  AND labels IS NOT NULL
  AND labels != '{}'::jsonb;

-- Step 3: Delete any remaining events that STILL have no state after backfill
-- (these are truly empty and unrecoverable)
DELETE FROM public.events
WHERE state IS NULL;

-- Step 4: Add a partial unique index as a dedup safety net.
-- This prevents duplicate events for the same execution from the same source.
-- The existing upsert_events RPC checks platform_event_id, but this index
-- catches cases where events slip through with the same name+timestamp.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup_name_ts
  ON public.events (tenant_id, source_id, name, timestamp)
  WHERE platform_event_id IS NOT NULL;

-- Step 5: Harden the upsert_events RPC to also check name+timestamp as fallback dedup
CREATE OR REPLACE FUNCTION upsert_events(p_events jsonb)
RETURNS TABLE(id uuid, is_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event jsonb;
  v_id uuid;
  v_existing_id uuid;
BEGIN
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    -- Guard: reject events with no state (would create ghost rows)
    IF v_event->'state' IS NULL OR v_event->>'state' = 'null' THEN
      RAISE WARNING '[upsert_events] Skipping event with no state: name=%, platform_event_id=%',
        v_event->>'name', v_event->>'platform_event_id';
      CONTINUE;
    END IF;

    -- Primary dedup: check platform_event_id
    IF v_event->>'platform_event_id' IS NOT NULL
       AND v_event->>'platform_event_id' != '' THEN
      SELECT e.id INTO v_existing_id
      FROM public.events e
      WHERE e.tenant_id = (v_event->>'tenant_id')::uuid
        AND e.source_id = (v_event->>'source_id')::uuid
        AND e.platform_event_id = v_event->>'platform_event_id';

      IF v_existing_id IS NOT NULL THEN
        -- Update existing record with fresh data
        UPDATE public.events SET
          type = COALESCE(v_event->>'type', type),
          name = COALESCE(v_event->>'name', name),
          value = COALESCE((v_event->>'value')::numeric, value),
          unit = COALESCE(v_event->>'unit', unit),
          text = COALESCE(v_event->>'text', text),
          state = COALESCE((v_event->'state')::jsonb, state),
          labels = COALESCE((v_event->'labels')::jsonb, labels),
          timestamp = COALESCE((v_event->>'timestamp')::timestamptz, timestamp)
        WHERE events.id = v_existing_id;

        id := v_existing_id;
        is_new := false;
        RETURN NEXT;
        CONTINUE;
      END IF;
    END IF;

    -- Secondary dedup: check name + timestamp (catches backfill re-runs)
    SELECT e.id INTO v_existing_id
    FROM public.events e
    WHERE e.tenant_id = (v_event->>'tenant_id')::uuid
      AND e.source_id = (v_event->>'source_id')::uuid
      AND e.name = v_event->>'name'
      AND e.timestamp = (v_event->>'timestamp')::timestamptz;

    IF v_existing_id IS NOT NULL THEN
      -- Update existing record
      UPDATE public.events SET
        state = COALESCE((v_event->'state')::jsonb, state),
        labels = COALESCE((v_event->'labels')::jsonb, labels),
        platform_event_id = COALESCE(v_event->>'platform_event_id', platform_event_id)
      WHERE events.id = v_existing_id;

      id := v_existing_id;
      is_new := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Insert new record
    INSERT INTO public.events (
      tenant_id, source_id, interface_id, run_id, type, name,
      value, unit, text, state, labels, timestamp, platform_event_id
    ) VALUES (
      (v_event->>'tenant_id')::uuid,
      (v_event->>'source_id')::uuid,
      (v_event->>'interface_id')::uuid,
      (v_event->>'run_id')::uuid,
      v_event->>'type',
      v_event->>'name',
      (v_event->>'value')::numeric,
      v_event->>'unit',
      v_event->>'text',
      (v_event->'state')::jsonb,
      COALESCE((v_event->'labels')::jsonb, '{}'::jsonb),
      COALESCE((v_event->>'timestamp')::timestamptz, now()),
      v_event->>'platform_event_id'
    )
    RETURNING events.id INTO v_id;

    id := v_id;
    is_new := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_events(jsonb) TO authenticated;
