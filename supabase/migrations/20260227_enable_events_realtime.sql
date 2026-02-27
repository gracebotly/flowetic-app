-- Enable Supabase Realtime for events table
-- Realtime requires authenticated users with tenant membership — NO anon access.

-- 1. Add events to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- 2. Authenticated-only SELECT scoped to tenant via memberships
--    This policy allows Realtime subscriptions ONLY for users who are
--    members of the tenant that owns the events.
--    The source_id filter on the Realtime channel further narrows delivery.
DO $$
BEGIN
  -- Drop the dangerous anon policy if it was ever applied
  DROP POLICY IF EXISTS "Anon can select events by source_id" ON public.events;

  -- Drop existing tenant select if present (idempotent)
  DROP POLICY IF EXISTS "Authenticated tenant members can select events" ON public.events;

  CREATE POLICY "Authenticated tenant members can select events"
    ON public.events
    FOR SELECT
    TO authenticated
    USING (
      tenant_id IN (
        SELECT m.tenant_id
        FROM public.memberships m
        WHERE m.user_id = auth.uid()
      )
    );
END $$;

-- NOTE: The existing service_role policy remains untouched:
--   "Service role full access to events" — used by server-side preview page
--   and agent operations.
--
-- TENANT BOUNDARY:
--   Server side: preview page uses service_role client, scopes by interface_id/source_id
--   Client side: Realtime uses authenticated client, RLS enforces tenant membership
--   The source_id filter on the Realtime channel is a DELIVERY filter (reduces traffic),
--   while RLS is the SECURITY filter (prevents cross-tenant data access).
