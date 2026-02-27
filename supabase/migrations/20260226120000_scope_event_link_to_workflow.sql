-- Fix: link_event_to_interface should only match if the event's workflow matches
-- the session's selected_entities (workflow name)
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
      -- ✅ FIX: Only link if workflow matches or session has no workflow filter
      AND (
        js.selected_entities IS NULL
        OR js.selected_entities = ''
        OR js.selected_entities = (NEW.state->>'workflow_name')
      )
    ORDER BY js.updated_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

-- One-time fix: For the current interface, remove events that don't belong
-- to the selected workflow. This fixes the existing 30-event contamination.
UPDATE public.events e
SET interface_id = NULL
FROM public.journey_sessions js
WHERE e.interface_id = js.preview_interface_id
  AND e.tenant_id = js.tenant_id
  AND js.selected_entities IS NOT NULL
  AND js.selected_entities != ''
  AND e.state->>'workflow_name' IS NOT NULL
  AND e.state->>'workflow_name' != js.selected_entities;
