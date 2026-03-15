-- ═══════════════════════════════════════════════════════════════
-- Drop the dead trigger + function that blocks ALL event inserts
--
-- Root cause: Migration 20260314_drop_dead_tables.sql dropped the
-- interfaces table and events.interface_id column via CASCADE.
-- But the trigger auto_link_event_interface still fires on every
-- INSERT into events and calls link_event_to_interface() which
-- references NEW.interface_id — a column that no longer exists.
--
-- Error: 'record "new" has no field "interface_id"' (Postgres 42703)
--
-- Impact: ALL event inserts fail silently across all platforms
-- (n8n, Make, Retell, Vapi). This prevents:
--   - Activity tab from showing any data
--   - Entity detail stats from populating from local events
--   - Refresh/sync operations from persisting events
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS auto_link_event_interface ON public.events;
DROP FUNCTION IF EXISTS public.link_event_to_interface();
