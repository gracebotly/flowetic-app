-- ============================================================
-- Bug 4: Add missing updated_at column + fix upsert RPC
-- ============================================================

-- Step 1a: Add missing column (IF NOT EXISTS = idempotent)
ALTER TABLE public.interface_versions
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 1b: Auto-update trigger using project's existing function
-- CREATE OR REPLACE TRIGGER is safe on Postgres 14+ (project runs PG 17)
CREATE OR REPLACE TRIGGER set_interface_versions_updated_at
  BEFORE UPDATE ON public.interface_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Step 1c: Replace the broken RPC function
--   Preserves exact signature: (p_interface_id, p_spec_json, p_design_tokens, p_created_by)
--   Preserves exact return type: TABLE(version_id uuid, was_inserted boolean)
--   Preserves SECURITY DEFINER for RLS bypass
CREATE OR REPLACE FUNCTION public.upsert_interface_version(
  p_interface_id uuid,
  p_spec_json jsonb,
  p_design_tokens jsonb DEFAULT '{}'::jsonb,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS TABLE(version_id uuid, was_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_inserted boolean;
BEGIN
  INSERT INTO public.interface_versions (interface_id, spec_json, design_tokens, created_by)
  VALUES (p_interface_id, p_spec_json, p_design_tokens, p_created_by)
  ON CONFLICT ON CONSTRAINT idx_interface_versions_dedup
  DO UPDATE SET
    updated_at = now()
  RETURNING id, (xmax = 0) AS was_new
  INTO v_id, v_inserted;

  RETURN QUERY SELECT v_id, v_inserted;
END;
$$;

-- ============================================================
-- Bug 6: Create events_flat VIEW to flatten state JSONB
-- ============================================================

-- CRITICAL: security_invoker = true ensures RLS policies on the
-- underlying events table are enforced for the querying user.
-- Without this, the view would bypass RLS and expose ALL tenants' data.
-- Requires Postgres 15+ (project runs PG 17).
CREATE OR REPLACE VIEW public.events_flat
WITH (security_invoker = true)
AS
SELECT
  id, tenant_id, source_id, interface_id, run_id,
  type, name, value, unit, text, state, labels,
  timestamp, created_at, platform_event_id,
  -- Flattened from state JSONB with proper type casting
  state->>'workflow_id'                AS workflow_id,
  state->>'status'                     AS status,
  (state->>'duration_ms')::numeric     AS duration_ms,
  state->>'mode'                       AS mode,
  state->>'workflow_name'              AS workflow_name,
  state->>'execution_id'              AS execution_id,
  (state->>'started_at')::timestamptz  AS started_at_ts,
  (state->>'ended_at')::timestamptz    AS ended_at_ts,
  state->>'error_message'             AS error_message
FROM public.events;

-- Grant access to API roles (RLS on underlying events table enforced via security_invoker)
GRANT SELECT ON public.events_flat TO anon, authenticated;
