-- Ensure service role can insert events (for agent operations)
DO $$
BEGIN
  -- Drop existing service role policy if it exists
  DROP POLICY IF EXISTS "Service role full access to events" ON public.events;

  -- Create comprehensive service role policy
  CREATE POLICY "Service role full access to events"
    ON public.events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

-- Also ensure tenant-based insert policy exists
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own tenant events" ON public.events;

  CREATE POLICY "Users can insert own tenant events"
    ON public.events FOR INSERT
    WITH CHECK (
      tenant_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
      OR auth.role() = 'service_role'
    );
END $$;
