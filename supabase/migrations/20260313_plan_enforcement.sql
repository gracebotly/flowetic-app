BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. Add plan columns to tenants
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'agency'
    CHECK (plan IN ('agency', 'scale', 'enterprise')),
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'trialing'
    CHECK (plan_status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (NOW() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS has_card_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz DEFAULT NOW();

-- Index for subscription lookups from webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_subscription
  ON public.tenants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_customer
  ON public.tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. Usage count view (for fast limit checks)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.tenant_usage AS
SELECT
  t.id AS tenant_id,
  t.plan,
  t.plan_status,
  t.trial_ends_at,
  t.has_card_on_file,
  (SELECT COUNT(*) FROM public.client_portals cp
   WHERE cp.tenant_id = t.id AND cp.status != 'archived') AS portal_count,
  (SELECT COUNT(*) FROM public.memberships m
   WHERE m.tenant_id = t.id AND m.invite_status = 'active') AS member_count,
  (SELECT COUNT(*) FROM public.clients c
   WHERE c.tenant_id = t.id AND c.status != 'archived') AS client_count
FROM public.tenants t;

-- ═══════════════════════════════════════════════════════════════
-- 3. RPC for atomic portal limit check
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_portal_limit(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan text;
  v_plan_status text;
  v_trial_ends_at timestamptz;
  v_count int;
  v_limit int;
BEGIN
  SELECT plan, plan_status, trial_ends_at
    INTO v_plan, v_plan_status, v_trial_ends_at
    FROM public.tenants WHERE id = p_tenant_id;

  IF v_plan_status = 'trialing' AND v_trial_ends_at < NOW() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'trial_expired',
      'current', 0, 'limit', 0, 'plan', v_plan);
  END IF;

  IF v_plan_status NOT IN ('active', 'trialing') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'plan_inactive',
      'current', 0, 'limit', 0, 'plan', v_plan);
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.client_portals
    WHERE tenant_id = p_tenant_id AND status != 'archived';

  v_limit := CASE v_plan
    WHEN 'agency' THEN 5
    WHEN 'scale' THEN 15
    WHEN 'enterprise' THEN 999999
    ELSE 5
  END;

  RETURN jsonb_build_object(
    'allowed', v_count < v_limit,
    'current', v_count,
    'limit', v_limit,
    'plan', v_plan,
    'reason', CASE WHEN v_count >= v_limit THEN 'limit_reached' ELSE NULL END
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. RPC for atomic team seat limit check
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_team_limit(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan text;
  v_plan_status text;
  v_trial_ends_at timestamptz;
  v_count int;
  v_limit int;
BEGIN
  SELECT plan, plan_status, trial_ends_at
    INTO v_plan, v_plan_status, v_trial_ends_at
    FROM public.tenants WHERE id = p_tenant_id;

  IF v_plan_status = 'trialing' AND v_trial_ends_at < NOW() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'trial_expired',
      'current', 0, 'limit', 0, 'plan', v_plan);
  END IF;

  IF v_plan_status NOT IN ('active', 'trialing') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'plan_inactive',
      'current', 0, 'limit', 0, 'plan', v_plan);
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.memberships
    WHERE tenant_id = p_tenant_id AND invite_status = 'active';

  v_limit := CASE v_plan
    WHEN 'agency' THEN 1
    WHEN 'scale' THEN 999999
    WHEN 'enterprise' THEN 999999
    ELSE 1
  END;

  RETURN jsonb_build_object(
    'allowed', v_count < v_limit,
    'current', v_count,
    'limit', v_limit,
    'plan', v_plan,
    'reason', CASE WHEN v_count >= v_limit THEN 'limit_reached' ELSE NULL END
  );
END;
$$;

COMMIT;
