-- ============================================================================
-- Fix 1: Clean up orphaned interfaces
-- ============================================================================

-- Delete interface_versions that belong to orphaned interfaces
-- (interfaces with no active_version_id, not referenced by events or journey_sessions)
DELETE FROM public.interface_versions
WHERE interface_id IN (
  SELECT i.id FROM public.interfaces i
  WHERE i.active_version_id IS NULL
    AND i.id NOT IN (
      SELECT DISTINCT preview_interface_id
      FROM public.journey_sessions
      WHERE preview_interface_id IS NOT NULL
    )
    AND i.id NOT IN (
      SELECT DISTINCT interface_id
      FROM public.events
      WHERE interface_id IS NOT NULL
    )
    AND i.id NOT IN (
      SELECT DISTINCT interface_id
      FROM public.interface_schemas
      WHERE interface_id IS NOT NULL
    )
);

-- Delete the orphaned interfaces themselves
DELETE FROM public.interfaces
WHERE active_version_id IS NULL
  AND id NOT IN (
    SELECT DISTINCT preview_interface_id
    FROM public.journey_sessions
    WHERE preview_interface_id IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT interface_id
    FROM public.events
    WHERE interface_id IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT interface_id
    FROM public.interface_schemas
    WHERE interface_id IS NOT NULL
  );

-- ============================================================================
-- Fix 2: Migrate all remaining legacy phase names
-- ============================================================================

UPDATE public.journey_sessions
SET mode = 'build_edit', updated_at = now()
WHERE mode = 'interactive_edit';

UPDATE public.journey_sessions
SET mode = 'propose', updated_at = now()
WHERE mode IN ('select_entity', 'recommend', 'style', 'align', 'story');

UPDATE public.journey_sessions
SET mode = 'build_edit', updated_at = now()
WHERE mode = 'build_preview';

-- ============================================================================
-- Fix 3: Improve the auto_link_event_interface trigger
-- Add tenant_id filter and use updated_at instead of created_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_event_to_interface()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.interface_id IS NULL AND NEW.source_id IS NOT NULL THEN
    SELECT js.preview_interface_id INTO NEW.interface_id
    FROM public.journey_sessions js
    WHERE js.source_id = NEW.source_id
      AND js.tenant_id = NEW.tenant_id
      AND js.preview_interface_id IS NOT NULL
    ORDER BY js.updated_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- Fix 4: Re-link current events to the most recent active interface per source
-- This is a one-time data fix for existing data
-- ============================================================================

-- For each source, find the most recently updated journey_session with a
-- preview_interface_id, then point all events for that source to that interface.
WITH latest_interface AS (
  SELECT DISTINCT ON (js.source_id, js.tenant_id)
    js.source_id,
    js.tenant_id,
    js.preview_interface_id
  FROM public.journey_sessions js
  WHERE js.preview_interface_id IS NOT NULL
    AND js.source_id IS NOT NULL
  ORDER BY js.source_id, js.tenant_id, js.updated_at DESC
)
UPDATE public.events e
SET interface_id = li.preview_interface_id
FROM latest_interface li
WHERE e.source_id = li.source_id
  AND e.tenant_id = li.tenant_id
  AND e.interface_id IS DISTINCT FROM li.preview_interface_id;
